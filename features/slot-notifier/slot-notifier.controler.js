const properties = require("../../config/properties");
const request = require('request');
const SimpleNodeLogger = require('simple-node-logger'),
    opts = {
        logFilePath: 'project.log',
        timestampFormat: 'YYYY-MM-DD HH:mm'
    },
    log = SimpleNodeLogger.createSimpleLogger(opts);

const accountSid = properties.accountSid;
const authToken = properties.authToken;
const client = require('twilio')(accountSid, authToken);

let isVaccantMsgSend = false;
let isReportMsgSend = false;
exports.startWatching = async function (req, res) {
    try {

        request(`${properties.baseUrl}/admin/location/states`, { json: true }, (err, statesResponse, statesBody) => {
            if (err) { return console.log(err); }
            const states = statesBody.states;
            const reqSateId = states.find((state) => state.state_name === properties.reuiredState[0]);
            request(`${properties.baseUrl}/admin/location/districts/${reqSateId.state_id}`, { json: true }, (err, districtResponse, districtBody) => {
                if (err) { return console.log(err); }
                const districts = districtBody.districts;
                const reqDistricts = properties.reuiredDistrict;
                reqDistricts.forEach((reqDist) => {
                    districts.forEach((dist) => {
                        if (dist.district_name === reqDist) {
                            watchInDetails(dist);
                        }
                    });
                });

                res.json('wating started');
            });
        });
    }

    catch (err) {

        res.json({
            err
        });
    }
}

function watchInDetails(district) {
    try {
        setInterval(function () {
            try {
                const currentYear = new Date().getFullYear();
                const currentMonth = new Date().getMonth() + 1;
                let currentDate = new Date().getDate();
                const todaysDate = `${currentDate}-${currentMonth}-${currentYear}`;
                const url = `${properties.baseUrl}/appointment/sessions/public/calendarByDistrict?district_id=${district.district_id}&date=${todaysDate}`;
                console.log(url);
                findData(url, district, todaysDate);


            }
            catch (err) {

                throw err;
            }
        }, properties.dataFetchingFrequency);
    }
    catch (err) {

        throw err;
    }



}

function findData(url, district, date) {

    request(url, { json: true }, (err, res, body) => {
        if (err) { return console.log(err); }
        let centers = [];
        centers = body.centers;
        if (!centers) {
            console.log(body);
        }
        let vaccanetCenters = [];
        if (centers) {
            centers.forEach((center) => {
                const isVaccent = center.sessions.find((session) => {
                    if (properties.isMaxAge45 && (session.available_capacity > 0 && session.min_age_limit == 45)) {
                        if (properties.isSecondDose) {
                            return session.available_capacity_dose2 > 0;
                        }
                        return session.available_capacity_dose1 > 0;
                    } else if (!properties.isMaxAge45 && (session.available_capacity > 0 && session.min_age_limit == 18)) {
                        if (properties.isSecondDose) {
                            return session.available_capacity_dose2 > 0;
                        }
                        return session.available_capacity_dose1 > 0;
                    }
                });
                if (isVaccent) {
                    vaccanetCenters.push(center);
                }
            });
            let allVaccinationCenter = JSON.stringify(vaccanetCenters);
            vaccanetCenters = vaccanetCenters.map((vc) => {
                let availableCapacity = 0;
                if (vc.sessions && vc.sessions.length > 0) {
                    availableCapacity = vc.sessions.reduce((acc, curVal) => {
                        if (properties.isSecondDose) {

                            acc = Number(acc) + curVal.available_capacity_dose2;
                        } else {

                            acc = Number(acc) + curVal.available_capacity_dose1;
                        }
                        return acc;
                    }, '');
                }

                const newVc = {
                    status: `${vc.name} [ ${availableCapacity} Nos ]==> ${vc.pincode}`,
                    distrcit: district.district_name,
                    date: date
                };
                return newVc;
            });
            const vcStatusArray = vaccanetCenters.map((vcSA) => vcSA.status);
            let vcStatus = JSON.stringify(vcStatusArray);
            if (vcStatus.length > 1557) {
                vcStatus = vcStatus.slice(0, 1557);
                vcStatus = `${vcStatus} please visit cowin portal for more details`;
            }
            log.info(`[${vcStatusArray.length}] `, 'vaccination centers avilable in ', district.district_name, ' on ', date, ' (Next 7 days)', ', they are  ', vcStatus);
            sheduleReportMsg(vcStatusArray, district, date, vcStatus);
            if (vaccanetCenters.length > 0) {
                log.info(allVaccinationCenter);
                sheduleVacancyMsg(vcStatusArray, district, date, vcStatus);
            }
        }


    });
}
function sheduleVacancyMsg(vcStatusArray, district, date, vcStatus) {
    if (isVaccantMsgSend === false) {
        sendMsg(`[${vcStatusArray.length}] vaccination centers avilable in ${district.district_name} on ${date} (Next 7 days), they are  ${vcStatus}`);

        isVaccantMsgSend = true;
        setTimeout(() => {
            isVaccantMsgSend = false;
        }, properties.avilabiltyReReportingFrequency);

    }
}
function sheduleReportMsg(vcStatusArray, district, date, vcStatus) {
    if (isReportMsgSend === false) {
        sendMsg(`[${vcStatusArray.length}] vaccination centers avilable in ${district.district_name} on ${date} (Next 7 days), they are  ${vcStatus}`);

        isReportMsgSend = true;
        setTimeout(() => {
            isReportMsgSend = false;
        }, 3600000);

    }
}
function sendMsg(msg) {
    try {
        const requestedNumbers = properties.requestedNumbers;
        requestedNumbers.forEach((number) => {
            client.messages
                .create({
                    body: msg,
                    from: 'whatsapp:+14155238886',
                    to: `whatsapp:+91${number}`
                })
                .then(() => console.log(`whatsapp: to 91${number}`))
                .done();
        });

    }

    catch (err) {
        throw err;
    }

}