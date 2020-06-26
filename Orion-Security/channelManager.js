module.exports = {
    createTextChannel: function (guild, name, options, parent) {
        return new Promise(resolve => {
            guild.channels.create(name, {
                type: 'text',
                permissionOverwrites: options,
            }).then(channel => {
                if (parent !== null) {
                    channel.setParent(parent).then(c => resolve(c));
                } else {
                    resolve(channel);
                }
            });
        });
    },
    createCategory: function (guild, name, options) {
        return new Promise(resolve => {
            resolve(guild.channels.create(name, {
                type: 'category',
                permissionOverwrites: options,
            }, options));
        });
    }
}