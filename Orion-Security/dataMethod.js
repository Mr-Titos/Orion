const fs = require('fs');
const DataMethod = require('./dataMethod.js');

const pathWelcomeMsg = "data/welcome.txt";
const pathWelcomeChannel = "data/welcome_channel.txt";
const pathRaidCategory = "data/raid_category.txt";
const pathError = "data/error.txt";


module.exports = {
    stackTraceError: function (error) {
        fs.writeFile(pathError, new Date().toLocaleString() + error, (err) => {
            if (err) {
                console.log("Error file writing failed:" + err.message);
            }
        });
    },

    getWelcomeMsg: function (member) {
        return new Promise((resolve, reject) => {
            fs.readFile(pathWelcomeMsg, 'utf8', (err, welcomeMsg) => {
                if (err) {
                    DataMethod.stackTraceError(err);
                    console.log(pathWelcomeMsg + " file read failed: ", err)
                    return
                } else {
                    resolve(welcomeMsg.replace('<user>', `<@${member.user.id}>`));
                }
            });
        });
    },

    setWelcomeMsg: function (content) {
        return new Promise(function (res, rej) {
            fs.writeFile(pathWelcomeMsg, content, (err) => {
                if (err) {
                    DataMethod.stackTraceError(err);
                    console.log(pathWelcomeMsg + " file writing failed:" + err.message);
                } else
                    res();
            });
        })
    },

    getWelcomeChannel: function () {
        return new Promise((resolve, reject) => {
            fs.readFile(pathWelcomeChannel, 'utf8', (err, welcomeChannel) => {
                if (err) {
                    DataMethod.stackTraceError(err);
                    console.log(pathWelcomeChannel + " file read failed: ", err)
                    return
                } else {
                    resolve(welcomeChannel);
                }
            });
        });
    },

    setWelcomeChannel: function (content) {
        return new Promise(function (res, rej) {
            fs.writeFile(pathWelcomeChannel, content, (err) => {
                if (err) {
                    DataMethod.stackTraceError(err);
                    console.log(pathWelcomeChannel + " file writing failed:" + err.message);
                } else
                    res();
            });
        })
    },

    getRaidCategory: function () {
        return new Promise((resolve, reject) => {
            fs.readFile(pathRaidCategory, 'utf8', (err, welcomeChannel) => {
                if (err) {
                    DataMethod.stackTraceError(err);
                    console.log(pathRaidCategory + " file read failed: ", err)
                    return
                } else {
                    resolve(welcomeChannel);
                }
            });
        });
    },

    setRaidCategory: function (content) {
        return new Promise(function (res, rej) {
            fs.writeFile(pathRaidCategory, content, (err) => {
                if (err) {
                    DataMethod.stackTraceError(err);
                    console.log(pathRaidCategory + " file writing failed:" + err.message);
                } else
                    res();
            });
        })
    }
}