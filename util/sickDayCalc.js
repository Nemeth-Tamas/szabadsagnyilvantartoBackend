module.exports.isSick = (tappenz) => {
    if (tappenz != undefined && (tappenz.endDate == null || new Date() < new Date(tappenz.endDate)) && new Date(tappenz.startDate) < new Date()) {
        return true;
    } else {
        return false;
    }
}

module.exports.isOnLeave = async (szabadsagok) => {
    if (szabadsagok != undefined) {
        let today = new Date();
        today = today.toISOString().split('T')[0]; // get date in YYYY-MM-DD format

        return szabadsagok.some(leave => leave.dates.includes(today));
    } else {
        return false;
    }
}