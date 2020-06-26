require('dotenv').config();
const Discord = require('discord.js');
const bot = new Discord.Client({
    fetchAllMembers: true,
    autoReconnect: true,
});
const DataMethod = require('./dataMethod.js');
const ChannelManager = require('./channelManager.js');

const token = process.env.DISCORD_TOKEN;
const prefix = "or!";
const status = "discord.gg/Orion";
const channelTimeInterval = 60000; // milliseconds
const kickBanTimeInterval = 60000; // milliseconds
const adminPermissions = ['KICK_MEMBERS', 'BAN_MEMBERS', 'ADMINISTRATOR', 'MANAGE_CHANNELS', 'MANAGE_GUILD', 'MANAGE_ROLES']
const authorizedId = ['724649847541596330' /*bot.user.id*/ , '717732736638648330' /*LaBoule_Bot*/ ];
const helpMsg = '``Prefix : ' + prefix + '``\n' +
    'Les commandes disponibles sont :' + '\n' +
    '- **setWelcome <message de bienvenue>** : Permet de configurer le message qui apparaitra lorsqu\'un nouveau membre rejoint le serveur ' + '\n' +
    '- **welcome channel** : A effectué dans le channel ou les messages de bienvenue apparaîtrons' + '\n' +
    '- **raidmode <0 ou 1 ou 2>** : Active / Désactive le raidmode sur le serveur (1: kick auto, 2: ban auto)' + '\n' +
    '- **harem** : Commande personnalisé commandé par ``Muzan`` [WIP] !';

let kickBanStacktrace = {};
let channelStacktrace = {};
let raidMode = 0; // 0: inactive; 1: kick-auto; 2: ban-auto;
let currentChanRaid;

bot.on('ready', function () {
    bot.user.setActivity(status, 1).then(() => {
        bot.guilds.cache.forEach(guild => {
            guild.members.cache.find(member => member.user.id === bot.user.id).setNickname(`[${prefix}] ${bot.user.username}`);
        });
        console.log("Orion-Bot connecté !");
    });
});


try {
    bot.on('message', async function (msg) {
        if (msg.guild === null || msg.author.id === bot.user.id || msg.author.bot) {
            return;
        };
        let member = msg.member;
        if (member === null || member === undefined) {
            await console.log('null');
            await msg.guild.members.fetch(msg.author.id);
        }
        if (!member.hasPermission('ADMINISTRATOR')) {
            return;
        }
        processMsg(msg.content).then(async function (parsedMsg) {
            switch (parsedMsg[0].toLowerCase()) {
                case 'setwelcome':
                    let rawwelcomeMsg = parsedMsg.slice(1, parsedMsg.length).toString().replace(/,/g, ' ');
                    DataMethod.setWelcomeMsg(rawwelcomeMsg).then(() => {
                        DataMethod.getWelcomeMsg(bot.guilds.first().owner).then(welcomeMsg =>
                            msg.channel.send("N'oubliez pas de mettre <user> pour mentionner l'utilisateur qui rejoint !" +
                                "\n\nLe message de bienvenue a été modifié pour :\n" + welcomeMsg)
                        );
                    });
                    break;
                case 'welcome':
                    if (parsedMsg[1] !== undefined && parsedMsg[1].toLowerCase() === 'channel') {
                        DataMethod.setWelcomeChannel(msg.channel.id).then(() => msg.channel.send("Les messages de bienvenue apparaîtrons dans ce channel"));
                    }
                    break;
                case 'raidmode':
                    if (parsedMsg[1] !== '0' && parsedMsg[1] !== '1' && parsedMsg[1] !== '2') {
                        msg.channel.send('Le raid mode doit être l\'un de ces paramètres suivant :' +
                            '\n0 : Inactif' +
                            '\n1: Kick automatique' +
                            '\n2: Ban automatique');
                        return;
                    }
                    if (raidMode !== 0 || parsedMsg[1] === '0') {
                        finaliseRaidmode(parsedMsg[1], msg.channel, currentChanRaid);
                        return;
                    }

                    isRaidCategory(msg.guild).then(raidCateogry => {
                        ChannelManager.createTextChannel(msg.guild, 'rl-' + new Date().toLocaleDateString(), [{
                                id: msg.guild.defaultRole.id,
                                deny: ['VIEW_CHANNEL'],
                            }], raidCateogry)
                            .then(chan => {
                                finaliseRaidmode(parsedMsg[1], msg.channel, chan);
                            });
                    });
                    break;
                case 'help':
                    msg.author.send(helpMsg);
                    break;
            }
        });
    });
} catch (exc) {
    if (exc instanceof WebSocket) {} else {
        console.log(exc);
        DataMethod.stackTraceError(exc);
    }
}

bot.on('guildMemberAdd', member => {
    return new Promise(resolve => {
        switch (raidMode) {
            case 0:
                if (member.user.bot) {
                    // Kick bot if its not the owner of the guild who add it
                    member.guild.fetchAuditLogs({
                            'type': 'BOT_ADD'
                        })
                        .then(logs => logs.entries.first())
                        .then(async function (entry) {
                            let executor = entry.executor;
                            if (member.guild.ownerID !== executor.id) {
                                member.kick();
                                DerankUser(executor, member.guild, `Invitation du bot ${member.user.tag}`);
                                resolve();
                            }
                        });
                }
                // Kick the member if its account is too young
                const timeUntilCreate = (Date.now() - member.user.createdTimestamp) / 1000 / 60 / 60 / 24;
                const timeDoubleAccount = 4; // Seniority the account need to join the server (in days)
                if (timeUntilCreate < timeDoubleAccount) {
                    member.user.send("Ton compte doit être crée depuis au moins 4 jours pour pouvoir accéder a ce serveur" +
                        '\n' + "Il va falloir attendre " + (timeDoubleAccount - Math.ceil(timeUntilCreate)) + " jour(s)").then(() => {
                        member.kick();
                        resolve();
                    });
                }

                // If the code reach here, then the user should join and be welcomed
                resolve(Welcome(member));
                break;
            case 1:
                member.kick();
                currentChanRaid.send(member.user.tag + ' has been kick - ' + new Date().toLocaleTimeString());
                resolve();
                break;
            case 2:
                member.ban();
                currentChanRaid.send(member.user.tag + ' has been ban' + new Date().toLocaleTimeString());
                resolve();
                break;
        }
    });
});

bot.on('channelDelete', channel => {
    channel.guild.fetchAuditLogs({
            'type': 'CHANNEL_DELETE'
        })
        .then(logs => logs.entries.first())
        .then(async function (entry) {
            let executor = entry.executor;
            if (channelStacktrace[executor.id] === undefined || channelStacktrace[executor.id] === null) {
                channelStacktrace[executor.id] = new Array();
                setTimeout(async function () {
                    channelStacktrace[executor.id] = null
                }, channelTimeInterval);
            }
            await channelStacktrace[executor.id].push({
                channelName: channel.name
            });
            if (channelStacktrace[executor.id].length === 3 && channel.guild.owner.id !== executor.id) {
                let names = '';
                await channelStacktrace[executor.id].forEach(stacktrace => names += '\n' + stacktrace.channelName);
                channel.guild.owner.send(`L\'utilisateur ${executor.tag} a supprimé 3 channels en moins de ${channelTimeInterval/1000/60} minute(s).\nLes channels supprimés sont : ${names}`);
            }
            if (channelStacktrace[executor.id].length === 5 && channel.guild.owner.id !== executor.id) {
                let names = '';
                await channelStacktrace[executor.id].forEach(stacktrace => names += '\n' + stacktrace.channelName);
                channel.guild.owner.send(`L\'utilisateur ${executor.tag} a supprimé 5 channels en moins de ${channelTimeInterval/1000/60} minute(s).\nLes channels supprimés sont : ${names}`);
                DerankUser(executor, channel.guild, `Suppresion de 5 channels en moins de ${channelTimeInterval/1000/60} minute(s)`)
            }
        })
});

bot.on('guildMemberRemove', member => {
    member.guild.fetchAuditLogs({
            'type': 'MEMBER_KICK'
        })
        .then(logs => logs.entries.first())
        .then(async function (entry) {
            let executor = entry.executor;
            if (kickBanStacktrace[executor.id] === undefined || kickBanStacktrace[executor.id] === null) {
                kickBanStacktrace[executor.id] = new Array();
                setTimeout(async function () {
                    kickBanStacktrace[executor.id] = null
                }, kickBanTimeInterval);
            }
            await kickBanStacktrace[executor.id].push({
                memberName: member.user.tag
            });
            if (kickBanStacktrace[executor.id].length === 2 && member.guild.owner.id !== executor.id) {
                let names = '';
                await kickBanStacktrace[executor.id].forEach(stacktrace => names += '\n' + stacktrace.memberName);
                member.guild.owner.send(`L\'utilisateur ${executor.tag} a kick / ban 3 utilisateurs en moins de ${kickBanTimeInterval/1000/60} minute(s).\nLes utilisateurs kick / ban sont : ${names}`);
            }
            if (kickBanStacktrace[executor.id].length === 7 && member.guild.owner.id !== executor.id) {
                DerankUser(executor, member.guild, `7 ban en moins de ${kickBanTimeInterval/1000/60} minute(s)`);
            }
        });
});

bot.on('roleUpdate', async function (oldrole, newrole) {
    oldrole.guild.fetchAuditLogs({
            'type': 'ROLE_UPDATE'
        })
        .then(logs => logs.entries.first())
        .then(entry => {
            if (oldrole.permissions === newrole.permissions) {
                return;
            }
            let executor = entry.executor;
            if (executor.id === newrole.guild.ownerID || authorizedId.some(id => executor.id === id)) {
                return;
            }
            hasPermAdmin(newrole).then(hasPerm => {
                if (hasPerm) {
                    newrole.setPermissions(new Discord.Permissions(oldrole.permissions));
                    DerankUser(executor, oldrole.guild, 'Ajout de permissions admin au role **' + oldrole.name + '**');
                }
            });
        });
});

bot.on('guildMemberUpdate', (oldMember, newMember) => {
    oldMember.guild.fetchAuditLogs({
            'type': 'MEMBER_ROLE_UPDATE'
        })
        .then(logs => logs.entries.first())
        .then(entry => {
            if (oldMember.roles.cache === newMember.roles.cache) {
                return;
            }
            let executor = entry.executor;
            if (executor.id === oldMember.guild.ownerID || authorizedId.some(id => executor.id === id)) {
                return;
            }
            let keyEntry = entry.changes[0].key;
            switch (keyEntry) {
                case '$add':
                    let newRoleId = entry.changes[0].new[0].id;
                    let newRole = oldMember.guild.roles.cache.find(role => role.id === newRoleId);
                    hasPermAdmin(newRole).then(hasPerm => {
                        if (hasPerm) {
                            newMember.roles.remove(newRole);
                            DerankUser(executor, oldMember.guild, 'Ajout d\'un role avec des permissions admin a l\'utilisateur **' + newMember.user.tag + '**');
                        }
                    });
                    break;
                case '$remove':
                    break;
            }
        });
});

function processMsg(rawMsg) {
    return new Promise(function (resolve, reject) {
        if (rawMsg.substring(0, prefix.length) === prefix)
            resolve(rawMsg.substring(prefix.length).split(' '));
    });
}

async function DerankUser(user, guild, reason) {
    try {
        const member = guild.members.cache.find(member => member.user.id === user.id);
        let rolesName = '';
        await member.roles.cache.forEach(role => {
            if (role.name !== '@everyone')
                rolesName += '\n\`\`' + role.name + '\`\`';
        });
        member.roles.remove(member.roles);
        guild.owner.send(`L'utilisateur **${user.tag}** vient d'etre derank\nMotif : ${reason} \nVoici les roles qui ont été enlevés : ${rolesName}`);
    } catch (exception) {
        console.error(exception);
        DataMethod.stackTraceError(exception);
    }
}

function Welcome(member) {
    DataMethod.getWelcomeMsg(member).then(welcomeMsg => {
        DataMethod.getWelcomeChannel().then(welcomeChannelId => {
            let channel = member.guild.channels.cache.find(channel => channel.id === welcomeChannelId);
            if (channel === undefined || channel === null) {
                member.guild.owner.send("Un utilisateur a rejoint le serveur sans que le channel pour les acceuillir soit configuré.\n**" +
                    prefix + "welcome channel** dans le channel ou le message doit apparaître");
                return;
            }
            channel.send(welcomeMsg).then(msg => {
                msg.delete(10000);
            });
        });
    });
}

function hasPermAdmin(role) {
    return new Promise(async function (resolve) {
        await adminPermissions.forEach(perm => {
            if (role.permissions.has(perm)) {
                resolve(true);
            }
        });
        resolve(false);
    })
}

function isRaidCategory(guild) {
    return new Promise(async function (resolve) {
        let category;
        await DataMethod.getRaidCategory().then(raidCategoryId => category = guild.channels.cache.find(chan => chan.id === raidCategoryId));
        if (category === null || category === undefined) {
            await ChannelManager.createCategory(guild, 'Orion Raid Logs', [{
                    id: guild.defaultRole.id,
                    deny: ['VIEW_CHANNEL'],
                }])
                .then(cat => {
                    category = cat;
                    DataMethod.setRaidCategory(cat.id);
                    resolve(cat);
                });
        } else {
            resolve(category);
        }
    });
}

function finaliseRaidmode(raidM, channel, raidChan) {
    raidMode = Number.parseInt(raidM);
    channel.send(raidM === '0' ? 'L\'anti raid a bien été désactivé' :
        'L\'anti raid a bien été activé en mode ' + (raidM === '1' ? 'kick' : 'ban'));
    bot.user.setActivity(raidM === '0' ? status : 'RAID MODE ' + raidM, 1);
    currentChanRaid = raidChan;
}

bot.on('error', error => {
    DataMethod.stackTraceError(error);
});
bot.login(token);