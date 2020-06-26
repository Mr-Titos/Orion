module.exports = {
    createTextChannel: function (guild, name, options, parent) {
        return new Promise(resolve => {
            guild.createChannel(name, "text", options).then(channel => {
                if (parent !== null) {
                    channel.setParent(parent.id).then(c => resolve(c));
                } else {
                    resolve(channel);
                }
            });
        });
    },
    createCategory: function (guild, name, options) {
        return new Promise(resolve => {
            resolve(guild.createChannel(name, "category", options));
        });
    }
}