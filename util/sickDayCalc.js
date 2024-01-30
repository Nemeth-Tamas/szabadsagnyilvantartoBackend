module.exports.isSick = (tappenz) => {
    if (tappenz != undefined && (tappenz.endDate == null || new Date() < new Date(tappenz.endDate)) && new Date(tappenz.startDate) < new Date()) {
        return true;
    } else {
        return false;
    }
}