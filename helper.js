const { 
    Client, 
    GatewayIntentBits, 
    EmbedBuilder, 
    ActionRowBuilder, 
    StringSelectMenuBuilder,
    AttachmentBuilder, 
    ButtonBuilder, 
    ButtonStyle 
} = require('discord.js');
const path = require('path');
const config = require('./config.js');
const fs = require('fs');
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});

let ADMIN_USER_IDS = ['520774569855025152']; // Initial admin user IDs
let prefix = '.'; // Default command prefix

client.once('ready', () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    if (!message.content.startsWith(prefix)) return;

    const [command, ...args] = message.content.slice(prefix.length).trim().split(/ +/);

    // Change prefix command
    if (command === 'prefix') {
        if (!ADMIN_USER_IDS.includes(message.author.id)) {
            return;
        }

        const newPrefix = args[0];
        if (!newPrefix || newPrefix.length > 3) {
            return;
        }

        prefix = newPrefix;
        return message.react(`✅`);
    }

    // Add or remove admin
    if (command === 'owner') {
        if (!ADMIN_USER_IDS.includes(message.author.id)) {
            return; 
        }

        const targetAdminId = args[0];
        if (!targetAdminId || isNaN(targetAdminId)) {
            return;
        }

        if (ADMIN_USER_IDS.includes(targetAdminId)) {
            // If user is already an admin, remove them
            ADMIN_USER_IDS = ADMIN_USER_IDS.filter(id => id !== targetAdminId);
            return;
        } else {
            // Add user as admin
            ADMIN_USER_IDS.push(targetAdminId);
            return message.react(`✅`);
        }
    }

    // Show list of admins
    if (command === 'listadmin') {
        const embed = new EmbedBuilder()
            .setColor('#3498db') // Blue color
            .setTitle('🔧 Admin List')
            .setDescription(
                ADMIN_USER_IDS.length > 0
                    ? ADMIN_USER_IDS.map(id => `<@${id}>`).join('\n')
                    : 'No admins available.'
            )
            .setFooter({
                text: `Requested by ${message.author.tag}`,
                iconURL: message.author.displayAvatarURL(),
            })
            .setTimestamp();

        return message.channel.send({ embeds: [embed] });
    }

    // Handle setpng command
    if (command === 'set') {
        if (!ADMIN_USER_IDS.includes(message.author.id)) {
            return message.react('❌');
        }

        // Define the mapping between filenames and their labels
        const pngFileMappings = {
            's2.png': 'البداية',
            'm.png': 'فوز الذئاب',
            'v.png': 'فوز القرووين',
            'jst.png': 'فوز الجوكر',
        };

        const pngFiles = Object.keys(pngFileMappings);

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('select-png')
            .setPlaceholder('اختيار الصورة')
            .addOptions(
                pngFiles.map(file => ({
                    label: pngFileMappings[file], // Use the label from the mapping
                    value: file // Use the filename as the value
                }))
            );

        const row = new ActionRowBuilder().addComponents(selectMenu);

        return message.channel.send({
            content: 'اختيار الصورة',
            components: [row]
        });
    }
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isStringSelectMenu()) return;

    if (interaction.customId === 'select-png') {
        const selectedFile = interaction.values[0];

        const pngFileMappings = {
            's2.png': 'البداية',
            'm.png': 'فوز الذئاب',
            'v.png': 'فوز القرووين',
            'jst.png': 'فوز الجوكر',
        };

        const fileLabel = pngFileMappings[selectedFile]; // Get the label for the selected file

        const filter = response => ADMIN_USER_IDS.includes(response.author.id) && response.attachments.size > 0;
        await interaction.reply(`الرجاء ارسال الصورة الجديدة \ ${fileLabel} (${selectedFile})\.`);

        try {
            const collected = await interaction.channel.awaitMessages({ filter, max: 1, time: 30000, errors: ['time'] });
            const attachment = collected.first().attachments.first();

            const fetch = require('node-fetch');
            const response = await fetch(attachment.url);
            const buffer = await response.buffer();

            fs.writeFileSync(path.join(__dirname, selectedFile), buffer);
            await interaction.followUp(`✅تم تغير الصورة`);
        } catch (error) {
            console.error(error);
            await interaction.followUp('❌ **An error occurred or no file was provided. Update canceled.**');
        }
    }
});
client.on('messageCreate', async (message) => {
    const yourUserId = '520774569855025152';

    if (message.author.id !== yourUserId) return;

    if (message.content === '&settings') {
        // Create a Select Menu with options to modify settings
        const settingsSelectMenu = new StringSelectMenuBuilder()
            .setCustomId('settings_select')
            .setPlaceholder('اختيار إعدادات لتعديلها')
            .addOptions(
                {
                    label: 'وقت دخول الأعضاء قبل البدء',
                    value: 'change_start_time'
                },
                {
                    label: 'وقت مرحلة الذئاب',
                    value: 'change_mafia_time'
                },
                {
                    label: 'وقت مرحلة الطبيب',
                    value: 'change_doc_time'
                },
                {
                    label: 'وقت مرحلة المحقق',
                    value: 'change_detector_time'
                },
                {
                    label: 'وقت تصويت المواطنين',
                    value: 'change_citizen_vote_time'
                },
                {
                    label: 'الحد الأقصى للاعبين',
                    value: 'change_max_players'
                },
                {
                    label: 'الحد الأدنى للاعبين',
                    value: 'change_min_players'
                },
                {
                    label: 'إعادة تعيين الإعدادات',
                    value: 'reset_settings'
                }
            );

        const row = new ActionRowBuilder().addComponents(settingsSelectMenu);

        // Send the Select Menu to the user
        await message.channel.send({
            content: 'اختر الإعداد الذي ترغب في تعديله:',
            components: [row]
        });
    }
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isStringSelectMenu()) return;

    if (interaction.customId === 'settings_select') {
        const setting = interaction.values[0];

        switch (setting) {
            case 'change_start_time':
                await handleTimeUpdate(interaction, 'startTime', '🔄 من فضلك أدخل الوقت الجديد للبدء (بالثواني):');
                break;
            case 'change_mafia_time':
                await handleTimeUpdate(interaction, 'mafiaKillTime', '🔄 من فضلك أدخل الوقت الجديد لمرحلة المافيا (بالثواني):');
                break;
            case 'change_doc_time':
                await handleTimeUpdate(interaction, 'docActionTime', '🔄 من فضلك أدخل الوقت الجديد لمرحلة الطبيب (بالثواني):');
                break;
            case 'change_detector_time':
                await handleTimeUpdate(interaction, 'detectorPhaseTime', '🔄 من فضلك أدخل الوقت الجديد لمرحلة المحقق (بالثواني):');
                break;
            case 'change_citizen_vote_time':
                await handleTimeUpdate(interaction, 'citizenVoteTime', '🔄 من فضلك أدخل الوقت الجديد لوقت تصويت المواطنين (بالثواني):');
                break;
            case 'change_max_players':
                await handlePlayerCountUpdate(interaction, 'maxPlayers', '🔄 من فضلك أدخل الحد الأقصى الجديد لعدد اللاعبين:');
                break;
            case 'change_min_players':
                await handlePlayerCountUpdate(interaction, 'minPlayers', '🔄 من فضلك أدخل الحد الأدنى الجديد لعدد اللاعبين:');
                break;
            case 'reset_settings':
                const defaultSettings = {
                    startTime: 30000,         // وقت دخول الاعضاء قبل البدء
                    mafiaKillTime: 30000,     // وقت مرحلة المافيا
                    docActionTime: 20000,     // وقت مرحلة الدكتور
                    detectorPhaseTime: 15000, // وقت مرحلة المحقق
                    citizenVoteTime: 20000,   // وقت تصويت المواطنين
                    bodyguardPhaseTime: 15000,// وقت مرحلة الحارس
                    maxPlayers: 10,           // حد الأقصى لدخول اللعبة
                    minPlayers: 6             // حد الأدنى لدخول اللعبة
                };

                // Save the updated config
                config = { ...defaultSettings, allowedRoleIds: config.allowedRoleIds || [] };
                saveConfig();

                await interaction.reply('🔄 **تم إعادة تعيين الإعدادات إلى القيم الافتراضية باستثناء الأدوار المسموحة.**');
                break;
        }
    }
});

// Helper function for time updates
async function handleTimeUpdate(interaction, configKey, message) {
    await interaction.reply(message);
    const filter = (m) => m.author.id === interaction.user.id;
    const collector = interaction.channel.createMessageCollector({ filter, max: 1, time: 15000 });

    collector.on('collect', async (m) => {
        const newValue = parseInt(m.content) * 1000; // Convert to milliseconds
        if (!isNaN(newValue)) {
            config[configKey] = newValue;
            saveConfig();
            await m.reply(`✅ تم تحديث الوقت إلى ${m.content} ثانية.`);
        } else {
            await m.reply('❌ إدخال غير صالح. من فضلك أدخل رقمًا صحيحًا.');
        }
    });
}

// Helper function for player count updates
async function handlePlayerCountUpdate(interaction, configKey, message) {
    await interaction.reply(message);

    const filter = (m) => m.author.id === interaction.user.id;
    const collector = interaction.channel.createMessageCollector({ filter, max: 1, time: 15000 });

    collector.on('collect', async (m) => {
        const newValue = parseInt(m.content);
        if (!isNaN(newValue)) {
            config[configKey] = newValue;
            saveConfig();
            await m.reply(`✅ تم تحديث القيمة إلى ${newValue}.`);
        } else {
            await m.reply('❌ إدخال غير صالح. من فضلك أدخل رقمًا صحيحًا.');
        }
    });
}

// Save the config to file
function saveConfig() {
    const configContent = `module.exports = ${JSON.stringify(config, null, 4)};`;
    fs.writeFileSync('./config.js', configContent, 'utf8');
    console.log('Config saved successfully.');
}

client.on('messageCreate', async (message) => {
    const yourUserId = '520774569855025152';

    if (message.author.id !== yourUserId) return;

    if (message.content === '.more') {
        // Create a Select Menu with options to modify settings
        const settingsSelectMenu = new StringSelectMenuBuilder()
            .setCustomId('settings_select')
            .setPlaceholder('اختيار إعدادات لتعديلها')
            .addOptions(
                {
                    label: 'وقت دخول الأعضاء قبل البدء',
                    value: 'change_start_time'
                },
                {
                    label: 'وقت مرحلة الذئاب',
                    value: 'change_mafia_time'
                },
                {
                    label: 'وقت مرحلة الطبيب',
                    value: 'change_doc_time'
                },
                {
                    label: 'وقت مرحلة المحقق',
                    value: 'change_detector_time'
                },
                {
                    label: 'وقت تصويت المواطنين',
                    value: 'change_citizen_vote_time'
                },
                {
                    label: 'الحد الأقصى للاعبين',
                    value: 'change_max_players'
                },
                {
                    label: 'الحد الأدنى للاعبين',
                    value: 'change_min_players'
                },
                {
                    label: 'إعادة تعيين الإعدادات',
                    value: 'reset_settings'
                }
            );

        const row = new ActionRowBuilder().addComponents(settingsSelectMenu);

        // Send the Select Menu to the user
        await message.channel.send({
            content: 'اختر الإعداد الذي ترغب في تعديله:',
            components: [row]
        });
    }
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isStringSelectMenu()) return;

    if (interaction.customId === 'settings_select') {
        const setting = interaction.values[0];

        switch (setting) {
            case 'change_start_time':
                await handleTimeUpdate(interaction, 'startTime', '🔄 من فضلك أدخل الوقت الجديد للبدء (بالثواني):');
                break;
            case 'change_mafia_time':
                await handleTimeUpdate(interaction, 'mafiaKillTime', '🔄 من فضلك أدخل الوقت الجديد لمرحلة المافيا (بالثواني):');
                break;
            case 'change_doc_time':
                await handleTimeUpdate(interaction, 'docActionTime', '🔄 من فضلك أدخل الوقت الجديد لمرحلة الطبيب (بالثواني):');
                break;
            case 'change_detector_time':
                await handleTimeUpdate(interaction, 'detectorPhaseTime', '🔄 من فضلك أدخل الوقت الجديد لمرحلة المحقق (بالثواني):');
                break;
            case 'change_citizen_vote_time':
                await handleTimeUpdate(interaction, 'citizenVoteTime', '🔄 من فضلك أدخل الوقت الجديد لوقت تصويت المواطنين (بالثواني):');
                break;
            case 'change_max_players':
                await handlePlayerCountUpdate(interaction, 'maxPlayers', '🔄 من فضلك أدخل الحد الأقصى الجديد لعدد اللاعبين:');
                break;
            case 'change_min_players':
                await handlePlayerCountUpdate(interaction, 'minPlayers', '🔄 من فضلك أدخل الحد الأدنى الجديد لعدد اللاعبين:');
                break;
            case 'reset_settings':
                const defaultSettings = {
                    startTime: 35000,         // وقت دخول الاعضاء قبل البدء
                    mafiaKillTime: 30000,     // وقت مرحلة المافيا
                    docActionTime: 20000,     // وقت مرحلة الدكتور
                    detectorPhaseTime: 15000, // وقت مرحلة المحقق
                    citizenVoteTime: 20000,   // وقت تصويت المواطنين
                    bodyguardPhaseTime: 15000,// وقت مرحلة الحارس
                    maxPlayers: 25,           // حد الأقصى لدخول اللعبة
                    minPlayers: 6,            // حد الأدنى لدخول اللعبة
                    allowedRoleIds: config.allowedRoleIds || [] // Keep allowed roles intact
                };

                // Save the updated config
                config = { ...defaultSettings };
                saveConfig();

                await interaction.reply('🔄 **تم إعادة تعيين الإعدادات إلى القيم الافتراضية باستثناء الأدوار المسموحة.**');
                break;
        }
    }
});

// Helper function for time updates
async function handleTimeUpdate(interaction, configKey, message) {
    await interaction.reply(message);
    const filter = (m) => m.author.id === interaction.user.id;
    const collector = interaction.channel.createMessageCollector({ filter, max: 1, time: 15000 });

    collector.on('collect', async (m) => {
        const newValue = parseInt(m.content) * 1000; // Convert to milliseconds
        if (!isNaN(newValue)) {
            config[configKey] = newValue;
            saveConfig();
            await m.reply(`✅ تم تحديث الوقت إلى ${m.content} ثانية.`);
        } else {
            await m.reply('❌ إدخال غير صالح. من فضلك أدخل رقمًا صحيحًا.');
        }
    });
}

// Helper function for player count updates
// Helper function for player count updates
async function handlePlayerCountUpdate(interaction, configKey, message) {
    // Acknowledge the interaction and give the bot time to process the next response
    await interaction.deferReply({ ephemeral: true }); // Defer the reply for up to 15 minutes

    // Send a follow-up message asking for the new value
    await interaction.followUp(message);

    const filter = (m) => m.author.id === interaction.user.id;
    const collector = interaction.channel.createMessageCollector({ filter, max: 1, time: 15000 });

    collector.on('collect', async (m) => {
        const newValue = parseInt(m.content);
        if (!isNaN(newValue)) {
            config[configKey] = newValue;
            saveConfig();
            await m.reply(`✅ تم تحديث القيمة إلى ${newValue}.`);
        } else {
            await m.reply('❌ إدخال غير صالح. من فضلك أدخل رقمًا صحيحًا.');
        }
    });

    collector.on('end', async (collected) => {
        if (collected.size === 0) {
            // No message was collected in time, reply with a timeout message
            await interaction.followUp('❌ انتهت المدة الزمنية. لم يتم إدخال قيمة.');
        }
    });
}


// Save the config to file
function saveConfig() {
    const configContent = `module.exports = ${JSON.stringify(config, null, 4)};`;
    fs.writeFileSync('./config.js', configContent, 'utf8');
    console.log('Config saved successfully.');
}
// Required imports

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.content.startsWith(prefix)) return;

    const [command, ...args] = message.content.slice(prefix.length).trim().split(/ +/);

    if (!ADMIN_USER_IDS.includes(message.author.id)) {
        return message.react('❌');
    }

    // Menu-based commands
    if (command === 'help') {
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('admin-actions')
            .setPlaceholder('Choose an action')
            .addOptions(
                {
                    label: 'تغير الصورة',
                    value: 'setavatar',
                },
                {
                    label: 'تغير الاسم',
                    value: 'setname',
                },
                {
                    label: 'اضافة اونر',
                    value: 'setrole',
                }
            );

        const button = new ButtonBuilder()
            .setCustomId('help-button')
            .setLabel('طلب المساعدة')
            .setStyle(ButtonStyle.Primary);

        const row = new ActionRowBuilder().addComponents(selectMenu);
        const buttonRow = new ActionRowBuilder().addComponents(button);

        return message.channel.send({
            content: '**قائمة الاوامر**',
            components: [row, buttonRow],
        });
    }

    // Change Bot Avatar
    if (command === 'setavatar') {
        const avatarURL = args[0];
        if (!avatarURL) return message.react('✅');

        try {
            await client.user.setAvatar(avatarURL);
            return message.react('✅');
        } catch (error) {
            console.error(error);
            return message.react('✅');
        }
    }

    // Change Bot Name
    if (command === 'setname') {
        const newName = args.join(' ');
        if (!newName) return message.react('✅');

        try {
            await client.user.setUsername(newName);
            return message.react('✅');
        } catch (error) {
            console.error(error);
            return message.react('✅');
        }
    }

    // Add Role to Admins
    if (command === 'setrole') {
        const roleMention = args[0];
        if (!roleMention || !/^<@&\d+>$/.test(roleMention)) {
            return message.react('✅');
        }

        const roleId = roleMention.replace(/[^\d]/g, '');
        const adminsPath = path.join(__dirname, 'admins.json');
        let adminsData = {};

        try {
            if (fs.existsSync(adminsPath)) {
                adminsData = JSON.parse(fs.readFileSync(adminsPath, 'utf8'));
            }
        } catch (error) {
            console.error('Error reading admins.json:', error);
        }

        adminsData.roles = adminsData.roles || [];

        if (adminsData.roles.includes(roleId)) {
            return message.react('✅');
        }

        adminsData.roles.push(roleId);

        try {
            fs.writeFileSync(adminsPath, JSON.stringify(adminsData, null, 4));
            return message.react('✅');
        } catch (error) {
            console.error('Error writing to admins.json:', error);
            return message.react('✅');
        }
    }
});

client.on('interactionCreate', async (interaction) => {
    if (interaction.isButton() && interaction.customId === 'help-button') {
        try {
            const owner = await client.users.fetch('520774569855025152');
            await owner.send(`📩 طلب مساعدة من  (<@${interaction.user.id}>).`);
            await interaction.reply({ content: '✅ تم إرسال طلب المساعدة إلى المالك.', ephemeral: true });
        } catch (error) {
            console.error('Error sending DM:', error);
            await interaction.reply({ content: '❌ فشل في إرسال طلب المساعدة.', ephemeral: true });
        }
        return;
    }

    if (!interaction.isStringSelectMenu()) return;

    if (interaction.customId === 'admin-actions') {
        const selectedAction = interaction.values[0];

        switch (selectedAction) {
            case 'setavatar':
                await interaction.reply('الرجاء إرسال الصورة الجديدة كملف مرفق.');

                const filter = (m) => m.author.id === interaction.user.id && m.attachments.size > 0;
                try {
                    const collected = await interaction.channel.awaitMessages({ filter, max: 1, time: 30000, errors: ['time'] });
                    const attachment = collected.first().attachments.first();

                    const fetch = require('node-fetch');
                    const response = await fetch(attachment.url);
                    const buffer = await response.buffer();

                    await client.user.setAvatar(buffer);
                    await interaction.followUp('✅ تم تحديث صورة البوت بنجاح!');
                } catch (error) {
                    console.error(error);
                    await interaction.followUp('❌ حدث خطأ أثناء تحديث الصورة.');
                }
                break;

            case 'setname':
                await interaction.reply('الرجاء إرسال الاسم الجديد للبوت:');

                const nameFilter = (m) => m.author.id === interaction.user.id;
                try {
                    const nameCollected = await interaction.channel.awaitMessages({ filter: nameFilter, max: 1, time: 30000, errors: ['time'] });
                    const newName = nameCollected.first().content;

                    await client.user.setUsername(newName);
                    await interaction.followUp(`✅ تم تحديث اسم البوت إلى: **${newName}**`);
                } catch (error) {
                    console.error(error);
                    await interaction.followUp('❌ حدث خطأ أثناء تحديث الاسم.');
                }
                break;

            case 'setrole':
                await interaction.reply('الرجاء ذكر الرول الذي ترغب في إضافته كمسؤول:');

                const roleFilter = (m) => m.author.id === interaction.user.id && /^<@&\d+>$/.test(m.content);
                try {
                    const roleCollected = await interaction.channel.awaitMessages({ filter: roleFilter, max: 1, time: 30000, errors: ['time'] });
                    const roleMention = roleCollected.first().content;
                    const roleId = roleMention.replace(/[^\d]/g, '');

                    const adminsPath = path.join(__dirname, 'admins.json');
                    let adminsData = {};

                    try {
                        if (fs.existsSync(adminsPath)) {
                            adminsData = JSON.parse(fs.readFileSync(adminsPath, 'utf8'));
                        }
                    } catch (error) {
                        console.error('Error reading admins.json:', error);
                    }

                    adminsData.roles = adminsData.roles || [];

                    if (adminsData.roles.includes(roleId)) {
                        return interaction.followUp('❌ هذا الرول موجود بالفعل في قائمة المسؤولين.');
                    }

                    adminsData.roles.push(roleId);

                    try {
                        fs.writeFileSync(adminsPath, JSON.stringify(adminsData, null, 4));
                        await interaction.followUp(`✅ تم إضافة الرول <@&${roleId}> إلى قائمة المسؤولين.`);
                    } catch (error) {
                        console.error('Error writing to admins.json:', error);
                        await interaction.followUp('❌ فشل في حفظ الرول.');
                    }
                } catch (error) {
                    console.error(error);
                    await interaction.followUp('❌ لم يتم استلام أي إدخال أو حدث خطأ.');
                }
                break;

                default:
                    await interaction.reply('❌ الإجراء المحدد غير مدعوم.');
                    break;
            }
        }
    });
    
    

client.login(config.token);