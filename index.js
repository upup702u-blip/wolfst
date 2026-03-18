const {
    Client,
    GatewayIntentBits,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType,
    ActivityType,
    StringSelectMenuBuilder,
    PermissionsBitField,
    AttachmentBuilder,
} = require('discord.js');
const path = require('path');
const config = require('./config.js');
const fetch = require('node-fetch');
const { createCanvas, loadImage } = require('canvas');
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
    ],
});
let gameState = {
    players: [],
    allPlayers: [],
    playerRoles: new Map(),
    mafias: [],
    doctor: null,
    detector: null,
    bodyguard: null,
    mayor: null,
    president: null,
    presidentUsedAbility: false,
    gameActive: false,
    protectedPlayer: null,
    shieldedPlayer: null,
    shieldedPlayerRound: null,
    killedPlayer: null,
    votes: new Map(),
    skipVotes: 0,
    totalVotes: 0,
    mafiaActions: new Map(),
    doctorActionTaken: false,
    doctorPhaseEnded: false,
    detectorUsedAbility: false,
    bodyguardUsedAbility: false,
    bodyguardPhaseEnded: false,
    gameMessage: null,
    mafiaMessages: new Map(),
    mafiaInteractions: new Map(),
    doctorInteraction: null,
    detectorInteraction: null,
    bodyguardInteraction: null,
    mayorInteraction: null,
    votePhaseActive: false,
    mafiaPhaseEnded: false,
    mafiaTimeout: null,
    currentRound: 0,
    princess: null,
    princessAbilityUsed: false,
    mafiaThread: null,
    townCrier: null,  
    playersAbilitiesDisabled: false,
    harlot: null,
    harlotTarget: null,  // Tracks the player visited by the Harlot each night
    jester: null, // Stores the player assigned as Jester
    hunter: null,             // اللاعب الذي يمثل الصياد
    hunterTarget: null,       // الهدف الذي اختاره الصياد ليأخذه معه
    hunterUsedAbility: false, // للتحقق ما إذا كان الصياد استخدم قدرته أم لا
    ghost: null,
};

const ownerPath = path.join(__dirname, 'owner.json');
let owner = require(ownerPath);

// Save changes to the config file
function saveConfig() {
    fs.writeFileSync(ownerPath, JSON.stringify(owner, null, 4), 'utf8');
}

const interactions = new Map();
let gameInterval = null;
let gameTimeouts = [];
client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}`);
    console.log(`Code by Eric`);
    resetGame();
    
    // Set the bot's activity
    client.user.setActivity({
        name: "Eric",
        type: ActivityType.Streaming,
        url: "https://twitch.tv/twitch_user",
    });
});
let justice = new Set(["1093714267536109679", "1205181165552803870","520774569855025152","764205712536371232"]);

client.on('messageCreate', async (message) => {
    try {
        if (message.author.bot) return;

        const member = message.member;

        // Check permissions function
        const hasPermission = () => {
            return (
                justice.has(message.author.id) ||
                owner.allowedChannels.includes(message.channel.id) ||
                owner.ownerIds.includes(message.author.id) ||
                member.roles.cache.some((role) => owner.allowedRoleIds.includes(role.id))
            );
        };

        // Handle "-الذيب" command
        if (message.content.startsWith('-الذيب')) {
            if (!hasPermission()) {
                //return message.channel.send('❌ **ليس لديك إذن لتشغيل اللعبة.**');
                return;
            }

            if (gameState.gameActive) {
                return message.channel.send('⚠️ **اللعبة جارية بالفعل.**');
            }

            await startGame(message);
        }

        // Handle "-ايقاف" command
        if (message.content.startsWith('-ايقاف')) {
            if (!hasPermission()) {
                //return message.channel.send('❌ **ليس لديك إذن لإيقاف اللعبة.**');
                return;
            }

            if (!gameState.gameActive) {
                return message.channel.send('**مافي لعبة ياكوتش**');
            }

            resetGame();
            return message.channel.send('**تم ايقاف اللعبة**');
        }

    } catch (error) {
        console.error('Error in messageCreate:', error);
        await message.channel.send('❌ **حدث خطأ غير متوقع أثناء معالجة الرسالة.**');
    }
});

async function startGame(message) {
    try {
        resetGame();
        gameState.gameActive = true;
        gameState.allPlayers = [];
        
        let timeLeft = config.startTime / 1000;

        // Load the background image
        const background = await loadImage(path.join(__dirname, 's2.png'));
        const canvas = createCanvas(background.width, background.height);
        const ctx = canvas.getContext('2d');

        // Draw the static background image
        ctx.drawImage(background, 0, 0, canvas.width, canvas.height);

        // Send the initial message with the timer and player count
        const attachment = new AttachmentBuilder(canvas.toBuffer(), { name: 'game-start.png' });
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('join_game')
                .setLabel('دخول')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('leave_game')
                .setLabel('انسحاب')
                .setStyle(ButtonStyle.Secondary)
        );

        gameState.gameMessage = await message.channel.send({
            content: `**@here ستبدأ اللعبه خلال : ${timeLeft} seconds\nعدد اللاعبين: 0/${config.maxPlayers}**`,
            files: [attachment],
            components: [row],
        });

        // Update game message text only every second
        gameInterval = setInterval(async () => {
            try {
                timeLeft--;

                // Update only the message content with the new time and player count
                if (gameState.gameMessage) {
                    await gameState.gameMessage.edit({
                        content: `**@here : ${timeLeft} seconds\nعدد اللاعبين: ${gameState.players.length}/${config.maxPlayers}**`,
                        components: [row],
                    });
                }

                if (timeLeft <= 0) {
                    clearInterval(gameInterval);
                    gameInterval = null;

                    const disabledRow = new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId('join_game')
                            .setLabel('دخول')
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(true),
                        new ButtonBuilder()
                            .setCustomId('leave_game')
                            .setLabel('انسحاب')
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(true)
                    );

                    if (gameState.gameMessage) {
                        await gameState.gameMessage.edit({
                            content: `@here بدأت اللعبة!\nعدد اللاعبين: ${gameState.players.length}/${config.maxPlayers}`,
                            components: [disabledRow],
                        }).catch((error) => {
                            console.error('Error editing game message:', error);
                            gameState.gameMessage = null;
                        });
                    }

                    if (gameState.players.length >= config.minPlayers) {
                        await assignRoles(message.channel);
                    } else {
                        gameState.gameActive = false;
                        await message.channel.send('**تم ايقاف اللعبة تحتاج الى 6 اشخاص للبدء**');
                        resetGame();
                    }
                }
            } catch (error) {
                console.error('Error in game interval:', error);
            }
        }, 1000);
    } catch (error) {
        console.error('Error in startGame:', error);
        await message.channel.send('❌ **Error starting the game.**');
    }
}
client.on('interactionCreate', async (interaction) => {
    try {
        if (!interaction.isButton()) return;

        const { customId } = interaction;

        if (customId === 'join_game') {
            if (gameState.players.length >= config.maxPlayers) {
                await interaction.reply({
                    content: '❌ **تم الوصول إلى الحد الأقصى من اللاعبين.**',
                    ephemeral: true,
                });
                return;
            }

            if (!gameState.players.includes(interaction.user.id)) {
                gameState.players.push(interaction.user.id);
                if (!gameState.allPlayers.includes(interaction.user.id)) {
                    gameState.allPlayers.push(interaction.user.id);
                }
                interactions.set(interaction.user.id, interaction);
                await interaction.reply({
                    content: '✅ **لقد انضممت إلى اللعبة!**',
                    ephemeral: true,
                });
            } else {
                await interaction.reply({
                    content: '❌ **أنت بالفعل في اللعبة!**',
                    ephemeral: true,
                });
            }
        } else if (customId === 'leave_game') {
            if (gameState.players.includes(interaction.user.id)) {
                gameState.players = gameState.players.filter((id) => id !== interaction.user.id);
                await interaction.reply({
                    content: '❌ **لقد غادرت اللعبة.**',
                    ephemeral: true,
                });
            } else {
                await interaction.reply({
                    content: '❌ **أنت لست في اللعبة.**',
                    ephemeral: true,
                });
            }
        } else if (customId.startsWith('kill_')) {
            await handleMafiaKill(interaction);
        } else if (customId.startsWith('protect_')) {
            await handleDoctorProtect(interaction);
        } else if (customId.startsWith('detect_')) {
            await handleDetectorDetect(interaction);
        } else if (customId === 'skip_detect') {
            await handleDetectorSkip(interaction);
        } else if (customId.startsWith('shield_')) {
            await handleBodyguardShield(interaction);
        } else if (customId === 'skip_shield') {
            await handleBodyguardSkip(interaction);
        } else if (customId.startsWith('visit_')) {  // New case for the Harlot
            await handleHarlotVisit(interaction);
        } else if (customId.startsWith('vote_')) {
            await handleVote(interaction);
        } else if (customId === 'skip_vote') {
            await handleSkipVote(interaction);
        } else if (customId === 'president_ability') {
            await handlePresidentAbility(interaction);
        } else if (customId.startsWith('president_select_')) {
            await handlePresidentSelection(interaction);
        } else if (customId.startsWith('hunter_target_')) {  // New case for Hunter
            await handleHunterTarget(interaction);
        }        
    } catch (error) {
        console.error('Error in interactionCreate:', error);
        if (!interaction.replied) {
            await interaction.reply({
                content: '❌ **حدث خطأ غير متوقع. حاول مرة أخرى.**',
                ephemeral: true,
            });
        }
    }
});

async function assignRoles(channel) {
    try {
        if (!gameState.gameActive) return;

        gameState.allPlayers = [...gameState.players];

        const shuffledPlayers = gameState.players.sort(() => Math.random() - 0.5);

        if (shuffledPlayers.length < 6) {
            await channel.send('❌ **عدد اللاعبين غير كافٍ لتعيين جميع الأدوار. تحتاج على الأقل إلى 6 لاعبين.**');
            resetGame();
            return;
        }

        let mafiaCount = 1;
        if (shuffledPlayers.length >= 8) {
            mafiaCount = 2;
        }
        if (shuffledPlayers.length >= 15) {
            mafiaCount = 3;
        }
        if (shuffledPlayers.length >= 23) {
            mafiaCount = 4;
        }
        if (shuffledPlayers.length >= 27) {
            mafiaCount = 6;
        }
       
        gameState.mafias = shuffledPlayers.slice(0, mafiaCount);
        gameState.doctor = shuffledPlayers[mafiaCount];
        gameState.detector = shuffledPlayers[mafiaCount + 1];
        gameState.bodyguard = shuffledPlayers[mafiaCount + 2];
        gameState.mayor = shuffledPlayers[mafiaCount + 3];
        gameState.sirien = shuffledPlayers[mafiaCount + 7]; 
        gameState.president = shuffledPlayers[mafiaCount + 4];
        gameState.princess = shuffledPlayers[mafiaCount + 5];
        gameState.townCrier = shuffledPlayers[mafiaCount + 11];
        gameState.harlot = shuffledPlayers[mafiaCount + 6]; 
        gameState.ghost = shuffledPlayers[mafiaCount + 8];
        gameState.jester = shuffledPlayers[mafiaCount + 12];       
        gameState.hunter = shuffledPlayers[mafiaCount + 9]; 
        shuffledPlayers.slice(mafiaCount + 5).forEach((player) => {
            gameState.playerRoles.set(player, 'قروي 👤');
        });

        for (const mafia of gameState.mafias) {
            gameState.playerRoles.set(mafia, 'ذئب');
        }
        
        gameState.playerRoles.set(gameState.doctor, 'طبيب 🧑‍⚕️');
        gameState.playerRoles.set(gameState.detector, 'المحقق 🕵️‍♂️');
        gameState.playerRoles.set(gameState.bodyguard, 'الحارس 🛡️');
        gameState.playerRoles.set(gameState.mayor, 'العمدة 👨‍✈️');
        gameState.playerRoles.set(gameState.president, 'الملك 👑');
        gameState.playerRoles.set(gameState.harlot, 'المغرية 💋');
        gameState.playerRoles.set(gameState.townCrier, 'ام زكي 🧕🏻');
        gameState.playerRoles.set(gameState.princess, 'الاميرة 👸🏼');
        gameState.playerRoles.set(gameState.sirien, 'المقموعة'); // Assign role to the Sirien // قم بتعديل الفهرس حسب الأدوار الأخرى
        gameState.playerRoles.set(gameState.hunter, 'صياد');
        gameState.playerRoles.set(gameState.jester, 'الجوكر 🃏');  
        gameState.playerRoles.set(gameState.ghost, 'النشبة 🤓');




        for (const playerId of gameState.players) {
            const role = gameState.playerRoles.get(playerId);
            const interaction = interactions.get(playerId);

            if (interaction) {
                if (!interaction.replied) {
                    await interaction.deferReply({ ephemeral: true }).catch((error) => {
                        console.error(`Error deferring interaction for player ${playerId}:`, error);
                    });
                }
                await interaction.followUp({
                    ephemeral: true,
                    content: ` **دورك هو:** **${role.toUpperCase()}**.`,
                }).catch((error) => {
                    console.error(`Error sending role to player ${playerId}:`, error);
                });
            } else {
                console.error(`Interaction for player ${playerId} not found.`);
            }
        }

        if (gameState.mafias.length >= 25) {
            try {
                const mafiaThread = await channel.threads.create({
                    name: `wolf Chat - Game ${gameState.currentRound}`,
                    autoArchiveDuration: 60,
                    type: ChannelType.PrivateThread,
                    invitable: false,
                });

                for (const mafiaId of gameState.mafias) {
                    await mafiaThread.members.add(mafiaId).catch((error) => {
                        console.error(`Error adding mafia member ${mafiaId} to thread:`, error);
                    });
                }

                gameState.mafiaThread = mafiaThread;

                const mafiaMentions = gameState.mafias.map(id => `<@${id}>`).join(', ');

                await mafiaThread.send(`${mafiaMentions}\n💀 **هذا هو الشات الخاص الذئاب. يمكنك مناقشة خططك هنا.**`);
            } catch (error) {
                console.error('Error creating mafia thread:', error);
                await channel.send('❌ **حدث خطأ أثناء إنشاء الشات الخاص الذئاب.**');
            }
        }

        

        await channel.send('🚨 **تم الكشف عن الأدوار لجميع اللاعبين. ستبدأ اللعبة في 5 ثواني.**');

        const timeout = setTimeout(() => startMafiaPhase(channel), 5000);
        gameTimeouts.push(timeout);
    } catch (error) {
        console.error('Error in assignRoles:', error);
        await channel.send('❌ **حدث خطأ أثناء تعيين الأدوار.**');
    }
}



function resetGame() {
    if (gameState.gameMessage) {
        disableButtons(gameState.gameMessage);
    }

    if (gameState.mafiaThread) {
        try {
            gameState.mafiaThread.delete().catch((error) => {
                console.error('Error deleting mafia thread:', error);
            });
            gameState.mafiaThread = null;
        } catch (error) {
            console.error('Error deleting mafia thread:', error);
        }
    }

 gameState = {
        players: [],
        allPlayers: [],
        playerRoles: new Map(),
        mafias: [],
        doctor: null,
        detector: null,
        bodyguard: null,
        mayor: null,
        president: null,
        presidentUsedAbility: false,
        gameActive: false,
        protectedPlayer: null,
        shieldedPlayer: null,
        shieldedPlayerRound: null,
        killedPlayer: null,
        votes: new Map(),
        skipVotes: 0,
        totalVotes: 0,
        mafiaActions: new Map(),
        doctorActionTaken: false,
        doctorPhaseEnded: false,
        detectorUsedAbility: false,
        bodyguardUsedAbility: false,
        bodyguardPhaseEnded: false,
        gameMessage: null,
        mafiaMessages: new Map(),
        mafiaInteractions: new Map(),
        doctorInteraction: null,
        detectorInteraction: null,
        bodyguardInteraction: null,
        mayorInteraction: null,
        votePhaseActive: false,
        mafiaPhaseEnded: false,
        mafiaTimeout: null,
        currentRound: 0,
        princess: null,
        princessAbilityUsed: false,
        mafiaThread: null,
        townCrier: null,  
        ghost: null,
        playersAbilitiesDisabled: false,
        harlot: null,
        harlotTarget: null,  // Tracks the player visited by the Harlot each night
        jester: null, // Stores the player assigned as Jester
        // خصائص دور الصياد
        hunter: null,             // اللاعب الذي يمثل الصياد
        hunterTarget: null,       // الهدف الذي اختاره الصياد ليأخذه معه
        hunterUsedAbility: false, // للتحقق ما إذا كان الصياد استخدم قدرته أم لا
    };
    
   
    interactions.clear();

    if (gameInterval) {
        clearInterval(gameInterval);
        gameInterval = null;
    }

    gameTimeouts.forEach((timeout) => clearTimeout(timeout));
    gameTimeouts = [];

    console.log('Game state has been reset.');
}


async function disableButtons(message) {
    if (!message) return;
    try {
        const fetchedMessage = await message.fetch().catch((error) => {
            if (error.code === 10008) {
                console.error('Message was deleted before it could be fetched.');
                return null;
            } else {
                throw error;
            }
        });

        if (!fetchedMessage) return;

        const disabledComponents = fetchedMessage.components.map((row) => {
            return new ActionRowBuilder().addComponents(
                row.components.map((button) =>
                    ButtonBuilder.from(button).setDisabled(true)
                )
            );
        });

        await fetchedMessage.edit({ components: disabledComponents }).catch((error) => {
            console.error('Error editing message to disable buttons:', error);
        });
    } catch (error) {
        if (error.code === 10008) {
            console.error('Error: Tried to disable buttons on a message that no longer exists.');
        } else {
            console.error('Error while disabling buttons:', error);
        }
    }
}

async function startMafiaPhase(channel) {
    try {
        if (!gameState.gameActive) return;

        gameState.currentRound += 1;

        if (gameState.shieldedPlayerRound !== null && gameState.currentRound > gameState.shieldedPlayerRound) {
            gameState.shieldedPlayer = null;
            gameState.shieldedPlayerRound = null;
        }

        gameState.mafiaActions.clear();
        gameState.mafiaPhaseEnded = false;

        const alivePlayers = gameState.players.filter((player) => !gameState.mafias.includes(player));

        if (alivePlayers.length === 0) {
            await channel.send('🎉 **فاز الذئاب! تم القضاء على جميع القرووين.**');
            gameState.gameActive = false;
            checkWinConditions(channel);
            return;
        }

        let availableTargets = alivePlayers;
        if (gameState.shieldedPlayer && gameState.players.includes(gameState.shieldedPlayer)) {
            availableTargets = availableTargets.filter((player) => player !== gameState.shieldedPlayer);
        }

        if (availableTargets.length === 0) {
            await channel.send('❌ **لا يوجد لاعبين يمكن للذئاب قتلهم.**');
            await new Promise(resolve => setTimeout(resolve, 3000)); // 3-second delay
            resolveMafiaActions(channel);
            return;
        }

        await channel.send('🐺 🔪 **الذئاب، حان دوركم لاختيار ضحيتكم.**');
        await new Promise(resolve => setTimeout(resolve, 2000)); // 2-second delay before buttons are displayed

        const buttons = availableTargets.map((player) =>
            new ButtonBuilder()
                .setCustomId(`kill_${player}`)
                .setLabel(
                    `${channel.guild.members.cache.get(player)?.displayName || 'Unknown'}`
                )
                .setStyle(ButtonStyle.Danger)
        );

        const rows = createButtonRows(buttons);

        for (const mafiaId of gameState.mafias) {
            const mafiaInteraction = interactions.get(mafiaId);

            if (mafiaInteraction) {
                if (mafiaInteraction.replied || mafiaInteraction.deferred) {
                    const message = await mafiaInteraction.followUp({
                        content: '🐺 **لقد تم اختيارك كـ ذئب. يجب عليك اختيار لاعب لقتله. إذا اخترت لاعبين مختلفين، سيتم اختيار الضحية عشوائيًا.**',
                        components: rows,
                        ephemeral: true,
                    });
                    gameState.mafiaMessages.set(mafiaId, message.id);
                    gameState.mafiaInteractions.set(mafiaId, mafiaInteraction);
                } else {
                    await mafiaInteraction.deferReply({ ephemeral: true });
                    const message = await mafiaInteraction.editReply({
                        content: '🐺  **لقد تم اختيارك كـ ذئب. يجب عليك اختيار لاعب لقتله. إذا اخترت لاعبين مختلفين، سيتم اختيار الضحية عشوائيًا.**',
                        components: rows,
                    });
                    gameState.mafiaMessages.set(mafiaId, message.id);
                    gameState.mafiaInteractions.set(mafiaId, mafiaInteraction);
                }
            } else {
                console.error(`Mafia interaction for player ${mafiaId} not found.`);
            }
        }

        gameState.mafiaTimeout = setTimeout(async () => {
            await handleMafiaTimeout(channel);
        }, config.mafiaKillTime);

        gameTimeouts.push(gameState.mafiaTimeout);
    } catch (error) {
        console.error('Error in startMafiaPhase:', error);
        await channel.send('❌ **حدث خطأ أثناء مرحلة الذئاب.**');
    }
}

async function handleMafiaTimeout(channel) {
    try {
        if (!gameState.gameActive || gameState.mafiaPhaseEnded) return;

        for (const mafiaId of gameState.mafias.slice()) {
            if (!gameState.mafiaActions.has(mafiaId)) {
                await channel.send(`💤 **الذئب <@${mafiaId}> رقد وتم طرده من اللعبة.**`);
                await new Promise(resolve => setTimeout(resolve, 2000)); // 2-second delay before removal
                gameState.players = gameState.players.filter((player) => player !== mafiaId);
                gameState.mafias = gameState.mafias.filter((mafia) => mafia !== mafiaId);

                const mafiaInteraction = gameState.mafiaInteractions.get(mafiaId);
                if (mafiaInteraction) {
                    try {
                        await mafiaInteraction.editReply({
                            content: '❌ **لم تقم باختيار أحد لقتله وتم إقصاؤك من اللعبة.**',
                            components: [],
                        });
                    } catch (err) {
                        console.error('Error editing Mafia message:', err);
                    }
                }
            }
        }

        if (gameState.mafias.length === 0) {
            await channel.send('🎉 **القرووين فازوا! تم القضاء على جميع الذئاب.**');
            gameState.gameActive = false;
            checkWinConditions(channel);
            return;
        }

        await resolveMafiaActions(channel);
    } catch (error) {
        console.error('Error in handleMafiaTimeout:', error);
    }
}

async function handleMafiaKill(interaction) {
    try {
        if (!gameState.gameActive || gameState.mafiaPhaseEnded) return;

        const mafiaId = interaction.user.id;

        if (!gameState.mafias.includes(mafiaId)) {
            await interaction.reply({
                content: '❌ **أنت لست ذئب.**',
                ephemeral: true,
            });
            return;
        }

        if (!gameState.mafiaActions.has(mafiaId)) {
            const playerId = interaction.customId.split('_')[1];

            if (!gameState.players.includes(playerId) || gameState.mafias.includes(playerId)) {
                await interaction.reply({
                    content: '❌ **لا يمكنك قتل هذا اللاعب.**',
                    ephemeral: true,
                });
                return;
            }

            gameState.mafiaActions.set(mafiaId, playerId);

            await interaction.update({
                content: `🔪 **لقد اخترت قتل <@${playerId}>. انتظر حتى يختار الذئاب الآخرون.**`,
                components: [],
            });

            if (gameState.mafiaActions.size === gameState.mafias.length) {
                if (gameState.mafiaTimeout) {
                    clearTimeout(gameState.mafiaTimeout);
                    gameState.mafiaTimeout = null;
                }
                await new Promise(resolve => setTimeout(resolve, 3000)); // 3-second delay before resolving
                await resolveMafiaActions(interaction.channel);
            }
        } else {
            await interaction.reply({
                content: '❌ **لقد قمت بالفعل باتخاذ قرارك.**',
                ephemeral: true,
            });
        }
    } catch (error) {
        console.error('Error in handleMfiaKill:', error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
                content: '❌ **حدث خطأ أثناء محاولة القتل. حاول مرة أخرى.**',
                ephemeral: true,
            });
        }
    }
}


async function resolveMafiaActions(channel) {
    try {
        if (!gameState.gameActive || gameState.mafiaPhaseEnded) return;
        gameState.mafiaPhaseEnded = true;

        const selectedTargets = Array.from(gameState.mafiaActions.values());

        if (selectedTargets.length === 0) {
            await new Promise(resolve => setTimeout(resolve, 3000)); // 3-second delay
            const timeout = setTimeout(() => startHarlotPhase(channel), 5000);
            gameTimeouts.push(timeout);
            return;
        }

        let targetToKill;
        if (selectedTargets.every((val, i, arr) => val === arr[0])) {
            targetToKill = selectedTargets[0];
        } else {
            targetToKill = selectedTargets[Math.floor(Math.random() * selectedTargets.length)];
            await new Promise(resolve => setTimeout(resolve, 3000)); // 3-second delay
        }

        gameState.killedPlayer = targetToKill;

        for (const mafiaId of gameState.mafias) {
            const mafiaInteraction = gameState.mafiaInteractions.get(mafiaId);
            if (mafiaInteraction) {
                try {
                    await mafiaInteraction.followUp({
                        content: `🗡️ **الضحية النهائية هي <@${targetToKill}>.**`,
                        ephemeral: true,
                    });
                } catch (err) {
                    console.error('Error notifying Mafia:', err);
                }
            }
        }

        await channel.send('🔪 **الذئاب انتهت من اختيارها.**');

        // Check if paralysis is active and reset it
        if (gameState.playersAbilitiesDisabled) {
            gameState.playersAbilitiesDisabled = false; // Reset the paralysis effect
            await channel.send('⚡ **تمت إزالة القمع عن جميع اللاعبين. يمكنكم استخدام قدراتكم الآن.**');
        }

        // Start Harlot Phase
        await new Promise(resolve => setTimeout(resolve, 3000)); // 3-second delay
       // await channel.send(' **الآن دور المغرية لاختيار لاعب للزيارة 💋.**');

        const timeout = setTimeout(() => startHarlotPhase(channel), 5000);
        gameTimeouts.push(timeout);
    } catch (error) {
        console.error('Error in resolveMafiaActions:', error);
    }
}

async function startHarlotPhase(channel) {
    try {
        if (!gameState.gameActive || !gameState.harlot || !gameState.players.includes(gameState.harlot)) {
           // await channel.send('💋 **المغرية غير موجود أو لم تعد على قيد الحياة. الانتقال إلى المرحلة التالية.**');
            startDoctorPhase(channel);
            return;
        }
        await channel.send(' **الآن دور المغرية لاختيار لاعب للزيارة 💋.**');
        const alivePlayers = gameState.players.filter(player => player !== gameState.harlot);

        const buttons = alivePlayers.map(player =>
            new ButtonBuilder()
                .setCustomId(`visit_${player}`)
                .setLabel(`${channel.guild.members.cache.get(player)?.displayName || 'Unknown'}`)
                .setStyle(ButtonStyle.Primary)
        );

        const rows = createButtonRows(buttons);

        const harlotInteraction = interactions.get(gameState.harlot);

        if (harlotInteraction) {
            if (harlotInteraction.replied || harlotInteraction.deferred) {
                const message = await harlotInteraction.followUp({
                    content: '💋 **لقد تم اختيارك كـ مغرية. اختر لاعبًا لزيارته الليلة.**',
                    components: rows,
                    ephemeral: true,
                });
                gameState.harlotInteraction = message.id;
            } else {
                await harlotInteraction.deferReply({ ephemeral: true });
                const message = await harlotInteraction.editReply({
                    content: '💋 **لقد تم اختيارك كـ مغرية. اختر لاعبًا لزيارته الليلة.**',
                    components: rows,
                });
                gameState.harlotInteraction = message.id;
            }
        } else {
            console.error('Harlot interaction not found.');
        }

        // Timeout for the Harlot Phase
        const timeout = setTimeout(() => {
            if (!gameState.harlotTarget && gameState.gameActive) {
                //Hchannel.send('💋 **المغرية لم تقم بزيارة أي شخص. الانتقال إلى المرحلة التالية.**');
                startDoctorPhase(channel);
            }
        }, config.harlotPhaseTime || 10000); // Adjust time as needed

        gameTimeouts.push(timeout);
    } catch (error) {
        console.error('Error in startHarlotPhase:', error);
       // await channel.send('❌ **حدث خطأ أثناء مرحلة المغرية.**');
        startDoctorPhase(channel);
    }
}
async function handleHarlotVisit(interaction) {
    try {
        if (!gameState.gameActive || gameState.harlot === null) {
            await interaction.reply({
                content: '❌ **اللعبة غير نشطة أو المغرية غير موجودة.**',
                ephemeral: true,
            });
            return;
        }

        const channel = interaction.channel; 
        const harlotId = interaction.user.id;

        if (harlotId !== gameState.harlot) {
            await interaction.reply({
                content: '❌ **أنت لست المغرية.**',
                ephemeral: true,
            });
            return;
        }

        const targetId = interaction.customId.split('_')[1];

        if (!gameState.players.includes(targetId)) {
            await interaction.reply({
                content: '❌ **لا يمكنك زيارة هذا اللاعب.**',
                ephemeral: true,
            });
            return;
        }

        // Set the Harlot's target
        gameState.harlotTarget = targetId;

        await interaction.update({
            content: `✅ **لقد اخترت زيارة <@${targetId}> هذه الليلة.**`,
            components: [],
        });

        // Announce the Harlot's visit
        await interaction.channel.send(` **المغرية قررت زيارة <@${targetId}> الليلة.💋**`);

        // Now use setTimeout after the channel has been defined
        setTimeout(() => startDoctorPhase(channel), 3000);

    } catch (error) {
        console.error('Error in handleHarlotVisit:', error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
                content: '❌ **حدث خطأ أثناء تحديد الهدف. حاول مرة أخرى.**',
                ephemeral: true,
            });
        }
    }
}
async function handleDoctorProtect(interaction) {
    try {
        if (!gameState.gameActive || gameState.doctorPhaseEnded) return;

        // Check if abilities are disabled
        if (gameState.playersAbilitiesDisabled) {
            await interaction.reply({
                content: '❌ **القدرات مشلولة حاليًا! لا يمكنك استخدام قدرتك حتى انتهاء دور الذئاب.**',
                ephemeral: true,
            });
            return;
        }

        if (!gameState.doctorActionTaken) {
            const playerId = interaction.customId.split('_')[1];

            if (!gameState.players.includes(playerId)) {
                await interaction.reply({
                    content: '❌ **لا يمكنك حماية هذا اللاعب.**',
                    ephemeral: true,
                });
                return;
            }

            gameState.protectedPlayer = playerId;
            gameState.doctorActionTaken = true;

            if (gameState.doctorTimeout) {
                clearTimeout(gameState.doctorTimeout);
                gameState.doctorTimeout = null;
            }

            await interaction.update({
                content: `✅ **لقد اخترت حماية <@${playerId}>.**`,
                components: [],
            });

            await interaction.channel.send('💉 **الطبيب قام بحماية أحد اللاعبين.**');

            // Delay before transitioning to the next phase
            await new Promise(resolve => setTimeout(resolve, 3000)); // 3-second delay
            gameState.doctorPhaseEnded = true;
            startBodyguardPhase(interaction.channel);
        } else {
            if (!interaction.deferred) await interaction.deferReply({ ephemeral: true });
            await interaction.followUp({
                content: '❌ **لقد قمت بالفعل باتخاذ قرارك.**',
                ephemeral: true,
            });
        }
    } catch (error) {
        console.error('Error in handleDoctorProtect:', error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
                content: '❌ **حدث خطأ أثناء الحماية. حاول مرة أخرى.**',
                ephemeral: true,
            });
        }
    }
}


async function startDoctorPhase(channel) {
    try {
        if (!gameState.gameActive) return;

        gameState.doctorActionTaken = false;
        gameState.doctorPhaseEnded = false;

        const alivePlayers = gameState.players;

        if (!alivePlayers.includes(gameState.doctor)) {
            //await channel.send('💉 **الطبيب غير موجود. الانتقال إلى المرحلة التالية.**');
            await new Promise(resolve => setTimeout(resolve, 3000)); // 3-second delay
            startBodyguardPhase(channel);
            return;
        }

        await channel.send('**الطبيب، حان دورك لحماية أحد اللاعبين.💉**');

        const buttons = alivePlayers.map((player) =>
            new ButtonBuilder()
                .setCustomId(`protect_${player}`)
                .setLabel(`${channel.guild.members.cache.get(player)?.displayName || 'Unknown'}`)
                .setStyle(ButtonStyle.Primary)
        );

        const rows = createButtonRows(buttons);
        const doctorInteraction = interactions.get(gameState.doctor);

        if (doctorInteraction) {
            if (doctorInteraction.replied || doctorInteraction.deferred) {
                const message = await doctorInteraction.followUp({
                    content: '💉 **لقد تم اختيارك كـ طبيب. يمكنك حماية أي لاعب، بما في ذلك نفسك، من القتل.**',
                    components: rows,
                    ephemeral: true,
                });
                gameState.doctorInteraction = doctorInteraction;
            } else {
                await doctorInteraction.deferReply({ ephemeral: true });
                await doctorInteraction.editReply({
                    content: '💉 **لقد تم اختيارك كـ طبيب. يمكنك حماية أي لاعب، بما في ذلك نفسك، من القتل.**',
                    components: rows,
                });
                gameState.doctorInteraction = doctorInteraction;
            }
        } else {
            console.error('Doctor interaction not found.');
        }

        gameState.doctorTimeout = setTimeout(async () => {
            if (!gameState.doctorActionTaken && gameState.gameActive && !gameState.doctorPhaseEnded) {
                await channel.send(`💉 **الطبيب رقد. سيتم طرد الطبيب <@${gameState.doctor}> من اللعبة.**`);
                await new Promise(resolve => setTimeout(resolve, 3000)); // 3-second delay
                if (gameState.doctorInteraction) {
                    try {
                        await gameState.doctorInteraction.editReply({
                            content: '❌ **لم تقم باختيار أي شخص للحماية.**',
                            components: [],
                        });
                    } catch (err) {
                        console.error('Error editing Doctor message:', err);
                    }
                }
                gameState.players = gameState.players.filter(
                    (player) => player !== gameState.doctor
                );
                gameState.doctor = null;
                gameState.doctorPhaseEnded = true;
                startBodyguardPhase(channel);
            }
        }, config.docActionTime);

        gameTimeouts.push(gameState.doctorTimeout);
    } catch (error) {
        console.error('Error in startDoctorPhase:', error);
        await channel.send('❌ **حدث خطأ أثناء مرحلة الطبيب.**');
    }
}


async function startBodyguardPhase(channel) {
    try {
        if (!gameState.gameActive) return;

        if (gameState.bodyguardUsedAbility || !gameState.players.includes(gameState.bodyguard)) {
            if (gameState.bodyguardUsedAbility) {
             //   await channel.send('🛡️ **الحارس استخدم قدرته بالفعل لذا سيتم التخطي.**');
            } else {
               // await channel.send('🛡️ **الحارس غير موجود لذا سيتم التخطي.**');
            }
            await new Promise(resolve => setTimeout(resolve, 3000)); // 3-second delay before moving to the next phase
            startDetectorPhase(channel);
            return;
        }

        gameState.bodyguardPhaseEnded = false;

        // Delay before notifying the Knight of their turn
        await new Promise(resolve => setTimeout(resolve, 2000)); // 2-second delay
        await channel.send('🛡️ **الحارس حان دورك لإعطاء الدرع.**');

       // await channel.send('🛡️ **يمكنك إعطاء درع لأحد اللاعبين مرة واحدة في اللعبة.**');

        const alivePlayers = gameState.players;

        const buttons = alivePlayers.map(player =>
            new ButtonBuilder()
                .setCustomId(`shield_${player}`)
                .setLabel(`${channel.guild.members.cache.get(player)?.displayName || 'Unknown'}`)
                .setStyle(ButtonStyle.Primary)
        );

        const skipButton = new ButtonBuilder()
            .setCustomId('skip_shield')
            .setLabel('تخطي إعطاء الدرع')
            .setStyle(ButtonStyle.Secondary);

        const rows = createButtonRows([...buttons, skipButton]);

        const bodyguardInteraction = interactions.get(gameState.bodyguard);

        if (bodyguardInteraction) {
            if (bodyguardInteraction.replied || bodyguardInteraction.deferred) {
                const message = await bodyguardInteraction.followUp({
                    content: '🛡️ **لقد تم اختيارك كـ الحارس. يمكنك إعطاء درع لأحد اللاعبين مرة واحدة في اللعبة.**',
                    components: rows,
                    ephemeral: true,
                });
                gameState.bodyguardInteraction = {
                    id: message.id,
                    interaction: bodyguardInteraction,
                };
            } else {
                await bodyguardInteraction.deferReply({ ephemeral: true });
                const message = await bodyguardInteraction.editReply({
                    content: '🛡️ **لقد تم اختيارك كـ الحارس. يمكنك إعطاء درع لأحد اللاعبين مرة واحدة في اللعبة.**',
                    components: rows,
                });
                gameState.bodyguardInteraction = {
                    id: message.id,
                    interaction: bodyguardInteraction,
                };
            }
        } else {
            console.error('Bodyguard interaction not found.');
        }

        const timeout = setTimeout(async () => {
            if (gameState.gameActive && !gameState.bodyguardPhaseEnded) {
                if (!gameState.bodyguardUsedAbility) {
                    await bodyguardInteraction.followUp({
                        content: '❌ **انتهى الوقت ولم تقم باتخاذ قرار. يمكنك إعطاء الدرع في جولة قادمة.**',
                        ephemeral: true,
                    });
                }
                gameState.bodyguardPhaseEnded = true;
                await new Promise(resolve => setTimeout(resolve, 3000)); // 3-second delay before moving to the next phase
                startDetectorPhase(channel);
            }
        }, config.bodyguardPhaseTime);

        gameTimeouts.push(timeout);
    } catch (error) {
        console.error('Error in startBodyguardPhase:', error);
        await channel.send('❌ **حدث خطأ أثناء مرحلة الحارس.**');
    }
}

async function handleBodyguardShield(interaction) {
    try {
        if (!gameState.gameActive || gameState.bodyguardPhaseEnded) return;

        if (gameState.bodyguardUsedAbility) {
            await interaction.reply({
                content: '❌ **لقد استخدمت بالفعل قدرتك على إعطاء الدرع.**',
                ephemeral: true,
            });
            return;
        }

        const playerId = interaction.customId.split('_')[1];

        if (!gameState.players.includes(playerId)) {
            await interaction.reply({
                content: '❌ **لا يمكنك إعطاء الدرع لهذا اللاعب.**',
                ephemeral: true,
            });
            return;
        }

        gameState.bodyguardUsedAbility = true;
        gameState.shieldedPlayer = playerId;
        gameState.shieldedPlayerRound = gameState.currentRound + 1;

        await interaction.update({
            content: `✅ **لقد اخترت إعطاء درع لـ <@${playerId}>. سيتم حمايته في الجولة القادمة.**`,
            components: [],
        });

        await interaction.channel.send(`🛡️ **الحارس قام بإعطاء الدرع لـ <@${playerId}>.**`);

        gameState.bodyguardPhaseEnded = true;

        // Delay before moving to the next phase
        await new Promise(resolve => setTimeout(resolve, 3000)); // 3-second delay
        startDetectorPhase(interaction.channel);
    } catch (error) {
        console.error('Error in handleBodyguardShield:', error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
                content: '❌ **حدث خطأ أثناء محاولة إعطاء الدرع. حاول مرة أخرى.**',
                ephemeral: true,
            });
        }
    }
}
async function handleBodyguardSkip(interaction) {
    try {
        if (!gameState.gameActive || gameState.bodyguardPhaseEnded) return;

        if (gameState.bodyguardUsedAbility) {
            await interaction.reply({
                content: '❌ **لقد استخدمت بالفعل قدرتك على إعطاء الدرع.**',
                ephemeral: true,
            });
            return;
        }

        await interaction.update({
            content: '⏩ **لقد اخترت تخطي إعطاء الدرع في هذه الجولة. يمكنك استخدامه في جولة قادمة.**',
            components: [],
        });

        await interaction.channel.send(`🛡️ **الحارس قرر عدم إعطاء الدرع في هذه الجولة.**`);

        gameState.bodyguardPhaseEnded = true;

        // Delay before moving to the next phase
        await new Promise(resolve => setTimeout(resolve, 3000)); // 3-second delay
        startDetectorPhase(interaction.channel);
    } catch (error) {
        console.error('Error in handleBodyguardSkip:', error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
                content: '❌ **حدث خطأ أثناء محاولة التخطي. حاول مرة أخرى.**',
                ephemeral: true,
            });
        }
    }
}


async function startDetectorPhase(channel) {
    try {
        if (!gameState.gameActive) return;

        if (gameState.detectorUsedAbility || !gameState.players.includes(gameState.detector)) {
            if (gameState.detectorUsedAbility) {
                //await channel.send('🕵️ **المحقق استخدم قدرته بالفعل لذا سيتم التخطي.**');
            } else {
              //  await channel.send('🕵️ **المحقق غير موجود لذا سيتم التخطي.**');
            }
            await new Promise(resolve => setTimeout(resolve, 3000)); // 3-second delay before moving to next phase
            resolveNightPhase(channel);
            return;
        }

        // Delay before notifying the المحقق
        await new Promise(resolve => setTimeout(resolve, 2000)); // 2-second delay
        await channel.send(' **المحقق، حان دورك لكشف دور أحد اللاعبين.🕵️**');

        const alivePlayers = gameState.players.filter(player => player !== gameState.detector);

        const buttons = alivePlayers.map(player =>
            new ButtonBuilder()
                .setCustomId(`detect_${player}`)
                .setLabel(`${channel.guild.members.cache.get(player)?.displayName || 'Unknown'}`)
                .setStyle(ButtonStyle.Primary)
        );

        const skipButton = new ButtonBuilder()
            .setCustomId('skip_detect')
            .setLabel('تخطي الكشف')
            .setStyle(ButtonStyle.Secondary);

        const rows = createButtonRows([...buttons, skipButton]);

        const detectorInteraction = interactions.get(gameState.detector);

        if (detectorInteraction) {
            if (detectorInteraction.replied || detectorInteraction.deferred) {
                const message = await detectorInteraction.followUp({
                    content: '🕵️ **لقد تم اختيارك كـ محقق. يمكنك كشف دور أحد اللاعبين مرة واحدة في اللعبة.**',
                    components: rows,
                    ephemeral: true,
                });
                gameState.detectorInteraction = {
                    id: message.id,
                    interaction: detectorInteraction,
                };
            } else {
                await detectorInteraction.deferReply({ ephemeral: true });
                const message = await detectorInteraction.editReply({
                    content: '🕵️ **لقد تم اختيارك كـ محقق. يمكنك كشف دور أحد اللاعبين مرة واحدة في اللعبة.**',
                    components: rows,
                });
                gameState.detectorInteraction = {
                    id: message.id,
                    interaction: detectorInteraction,
                };
            }
        } else {
            console.error('Detector interaction not found.');
        }

        // Delay before skipping to the next phase if the المحقق does not act
        const timeout = setTimeout(async () => {
            if (gameState.gameActive) {
                if (!gameState.detectorUsedAbility) {
                    await detectorInteraction.followUp({
                        content: '❌ **انتهى الوقت ولم تقم باتخاذ قرار. يمكنك الكشف في جولة قادمة.**',
                        ephemeral: true,
                    });
                    await new Promise(resolve => setTimeout(resolve, 3000)); // 3-second delay before next phase
                }
                resolveNightPhase(channel);
            }
        }, config.detectorPhaseTime);

        gameTimeouts.push(timeout);
    } catch (error) {
        console.error('Error in startDetectorPhase:', error);
        await channel.send('❌ **حدث خطأ أثناء مرحلة المحقق.**');
    }
}


async function handleDetectorDetect(interaction) {
    try {
        if (!gameState.gameActive) return;

        // Check if abilities are disabled
        if (gameState.playersAbilitiesDisabled) {
            await interaction.reply({
                content: '❌ **القدرات مقموعة حاليًا! لا يمكنك استخدام قدرتك حتى انتهاء دور الذئاب.**',
                ephemeral: true,
            });
            return;
        }

        if (gameState.detectorUsedAbility) {
            await interaction.reply({
                content: '❌ **لقد استخدمت بالفعل قدرتك على الكشف.**',
                ephemeral: true,
            });
            return;
        }

        const playerId = interaction.customId.split('_')[1];

        if (!gameState.players.includes(playerId)) {
            await interaction.reply({
                content: '❌ **لا يمكنك كشف دور هذا اللاعب.**',
                ephemeral: true,
            });
            return;
        }

        gameState.detectorUsedAbility = true;

        const role = gameState.playerRoles.get(playerId) || 'مواطن';

        await interaction.update({
            content: `🔍 **لقد اخترت كشف دور <@${playerId}>. دوره هو: ${role.toUpperCase()}.**`,
            components: [],
        });

        await interaction.channel.send(`🔍 **المحقق قام بكشف دور <@${playerId}>.**`);

        const timeout = setTimeout(() => resolveNightPhase(interaction.channel), 5000);
        gameTimeouts.push(timeout);
    } catch (error) {
        console.error('Error in handleDetectorDetect:', error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
                content: '❌ **حدث خطأ أثناء محاولة الكشف. حاول مرة أخرى.**',
                ephemeral: true,
            });
        }
    }
}


async function handleDetectorSkip(interaction) {
    try {
        if (!gameState.gameActive) return;

        if (gameState.detectorUsedAbility) {
            await interaction.reply({
                content: '❌ **لقد استخدمت بالفعل قدرتك على الكشف.**',
                ephemeral: true,
            });
            return;
        }

        await interaction.update({
            content: '⏩ **لقد اخترت تخطي الكشف في هذه الجولة. يمكنك الكشف في جولة قادمة.**',
            components: [],
        });

        await interaction.channel.send(`🔍 **المحقق قرر عدم الكشف في هذه الجولة.**`);

        const timeout = setTimeout(() => resolveNightPhase(interaction.channel), 5000);
        gameTimeouts.push(timeout);
    } catch (error) {
        console.error('Error in handleDetectorSkip:', error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
                content: '❌ **حدث خطأ أثناء محاولة التخطي. حاول مرة أخرى.**',
                ephemeral: true,
            });
        }
    }
}
async function resolveNightPhase(channel) {
    try {
        if (!gameState.gameActive) return;

        const killedPlayer = gameState.killedPlayer;
        const protectedPlayer = gameState.protectedPlayer;
        const shieldedPlayer = gameState.shieldedPlayer;
        const shieldedPlayerRound = gameState.shieldedPlayerRound;
        const harlotPlayer = gameState.harlot;
        const harlotTarget = gameState.harlotTarget;

        // Handle Bodyguard's shield
        if (
            killedPlayer === shieldedPlayer &&
            shieldedPlayerRound === gameState.currentRound
        ) {
            await channel.send(`🛡️ **فشلت عملية القتل لأن <@${shieldedPlayer}> كان محميًا بواسطة الحارس!**`);
            gameState.killedPlayer = null; // Cancel the kill
            gameState.shieldedPlayer = null; // Reset shield after use
            gameState.shieldedPlayerRound = null;
        }

        // Handle Harlot's visit
        if (harlotPlayer && harlotTarget) {
            const harlotTargetRole = gameState.playerRoles.get(harlotTarget);

            if (harlotTargetRole === 'ذئب') {
                await channel.send(` **<@${harlotTarget}> زارته المغرية وقتل لأنه كان ذئبًا!💥**`);
                gameState.players = gameState.players.filter(player => player !== harlotTarget);
                gameState.mafias = gameState.mafias.filter(mafia => mafia !== harlotTarget);            
            } else if (killedPlayer === harlotTarget) {
                // Cancel the kill if the Harlot visited the target
                await channel.send(`**<@${harlotTarget}> تم حمايته من الهجوم بواسطة زيارة المغرية!👨‍❤️‍💋‍👨  **`);
                gameState.killedPlayer = null;
            }
        }

        // Handle Doctor's protection
        if (killedPlayer && killedPlayer === protectedPlayer) {
            await channel.send(`💉 **فشلت عملية القتل لأن <@${protectedPlayer}> تم حمايته من قبل الطبيب!**`);
            gameState.killedPlayer = null; // Cancel the kill
        }

        // Handle killing the player (if not protected)
        if (killedPlayer && gameState.killedPlayer) {
            gameState.players = gameState.players.filter(player => player !== killedPlayer);
            const role = gameState.playerRoles.get(killedPlayer);

            await channel.send(`💀 **تم قتل <@${killedPlayer}> هذه الليلة. دوره كان: ${role.toUpperCase()}**`);

            // Reveal a random Mafia member if "Town Crier" is killed
            if (role === 'ام زكي 🧕🏻') {
                await channel.send('🔍 **تم قتل "ام زكي"! سيتم كشف أحد أعضاء الذئاب عشوائيًا.**');
                const randomMafiaPlayer = gameState.mafias[Math.floor(Math.random() * gameState.mafias.length)];
                await channel.send(`🚨 **تم كشف أحد أعضاء الذئاب: <@${randomMafiaPlayer}>!**`);
            }
        }

        // Handle Ghost Interaction
        if (gameState.ghost && !gameState.players.includes(gameState.ghost)) {
            const ghostInteraction = interactions.get(gameState.ghost);
            if (ghostInteraction) {
                const alivePlayers = gameState.players;

                const buttons = alivePlayers.map(player =>
                    new ButtonBuilder()
                        .setCustomId(`ghost_action_${player}`)
                        .setLabel(`${channel.guild.members.cache.get(player)?.displayName || 'Unknown'}`)
                        .setStyle(ButtonStyle.Primary)
                );

                const rows = createButtonRows(buttons);

                await ghostInteraction.followUp({
                    content: '**انت الحين ميت بس نشبة غثهم بالتصويت 🤓**',
                    components: rows,
                    ephemeral: true,
                });

                const timeout = setTimeout(() => {
                    if (!gameState.ghostAction) {
                        //channel.send(`❌ **الشبح <@${gameState.ghost}> لم يتخذ أي إجراء.**`);
                    }
                }, 10000); // 10 seconds
                gameTimeouts.push(timeout);
            }
        }

        // Reset night state
        gameState.killedPlayer = null;
        gameState.protectedPlayer = null;
        gameState.harlotTarget = null;
        gameState.shieldedPlayer = null; 
        gameState.princess = null;

        // Check for win conditions
        if (checkWinConditions(channel)) {
            return;
        }

        // Proceed to the vote phase
        if (gameState.gameActive) {
            setTimeout(() => startVotePhase(channel), 3000); // 3-second delay
        }
    } catch (error) {
        console.error('Error in resolveNightPhase:', error);
        await channel.send('❌ **حدث خطأ أثناء إنهاء المرحلة الليلية.**');
    }
}


async function handleHunterTarget(interaction) {
    try {
        if (!gameState.gameActive || !gameState.hunter) {
            await interaction.reply({
                content: '❌ **اللعبة غير نشطة أو دور الصياد غير موجود.**',
                ephemeral: true,
            });
            return;
        }

        const hunterId = interaction.user.id;

        if (hunterId !== gameState.hunter) {
            await interaction.reply({
                content: '❌ **هذه القدرة خاصة بالصياد فقط.**',
                ephemeral: true,
            });
            return;
        }

        const targetId = interaction.customId.split('_')[2];

        if (!gameState.players.includes(targetId)) {
            await interaction.reply({
                content: '❌ **لا يمكنك اختيار هذا اللاعب.**',
                ephemeral: true,
            });
            return;
        }

        if (targetId === hunterId) {
            await interaction.reply({
                content: '❌ **لا يمكنك أخذ نفسك إلى القبر!**',
                ephemeral: true,
            });
            return;
        }

        // Register the target chosen by the hunter
        gameState.hunterTarget = targetId;

        // Remove the target and the hunter from the players list
        gameState.players = gameState.players.filter(player => player !== targetId && player !== hunterId);

        // Clear the Hunter role
        gameState.hunter = null;

        // Notify the players
        await interaction.update({
            content: `✅ **لقد اخترت أخذ <@${targetId}> معك إلى القبر.**`,
            components: [],
        });

        await interaction.channel.send(`🪓 **الصياد <@${hunterId}> أخذ معه <@${targetId}> إلى القبر!**`);

        // Check for win conditions after the action
        if (!checkWinConditions(interaction.channel)) {
            // Proceed to the next phase if no win condition is met
            setTimeout(() => resolveNightPhase(interaction.channel), 3000);
        }

    } catch (error) {
        console.error('Error in handleHunterTarget:', error);
        if (!interaction.replied) {
            await interaction.reply({
                content: '❌ **حدث خطأ أثناء تحديد الهدف. حاول مرة أخرى.**',
                ephemeral: true,
            });
        }
    }
}



const sqlite3 = require("sqlite3").verbose();

// Initialize the database
const db = new sqlite3.Database("./points.db", (err) => {
  if (err) return console.error("خطأ في قاعدة البيانات:", err.message);
  console.log("تم إعداد قاعدة البيانات بنجاح.");
});

// Create table for points
db.run(
  `CREATE TABLE IF NOT EXISTS points (userId TEXT PRIMARY KEY, points INTEGER)`,
  (err) => {
    if (err) console.error("خطأ في إنشاء جدول النقاط:", err.message);
  }
);

// Function to update points
function updatePoints(userId, points) {
  db.run(
    `INSERT INTO points (userId, points) VALUES (?, ?) 
    ON CONFLICT(userId) DO UPDATE SET points = points + ?`,
    [userId, points, points],
    (err) => {
      if (err) console.error("خطأ في تحديث النقاط:", err.message);
    }
  );
}

function checkWinConditions(channel) {
  try {
    const mafiaCount = gameState.players.filter(
      (player) => gameState.playerRoles.get(player) === "ذئب"
    ).length;

    const citizenCount = gameState.players.length - mafiaCount;
    let winner = null;

    if (mafiaCount === 0) {
      winner = "🎉 **القرووين فازوا!**";
    } else if (mafiaCount >= citizenCount) {
      winner = "💀 **فازت الذئاب!**";
    }

    if (winner) {
      const imagePath = mafiaCount === 0 ? "v.png" : "m.png";
      const winningTeam =
        mafiaCount === 0
          ? gameState.players.filter(
              (player) => gameState.playerRoles.get(player) !== "ذئب"
            )
          : gameState.players.filter(
              (player) => gameState.playerRoles.get(player) === "ذئب"
            );

      const winningMentions = winningTeam
        .map((playerId) => `<@${playerId}>`)
        .join(", ");
      const alivePlayers = getAlivePlayers();

      // Assign points
      if (mafiaCount === 0) {
        // Villagers win
        winningTeam.forEach((player) => updatePoints(player, 1));
      } else {
        // Wolves win
        winningTeam.forEach((player) => updatePoints(player, 3));
      }

      // All alive players get participation points

      const filePath = path.join(__dirname, imagePath);
      const attachment = new AttachmentBuilder(filePath);

      // Send results
      channel.send({ files: [attachment] }).then(() => {
        channel.send(`**||@here||  ${winningMentions} 🏆**`);
      });

      resetGame();
      return true;
    }

    return false;
  } catch (error) {
    console.error("Error in checkWinConditions:", error);
    return false;
  }
}

// Function to fetch leaderboard
function fetchLeaderboard(callback) {
  db.all(
    `SELECT userId, points FROM points ORDER BY points DESC LIMIT 10`,
    (err, rows) => {
      if (err) {
        console.error("خطأ في استرجاع الترتيب:", err.message);
        return;
      }
      callback(rows);
    }
  );
}

function getAlivePlayers() {
    if (gameState.players.length === 0) return 'لا يوجد أحياء.';
    return gameState.players.map((id) => `<@${id}>`).join(', ');
}

async function startVotePhase(channel) {
    try {
        if (!gameState.gameActive || gameState.votePhaseActive) return;
        gameState.votePhaseActive = true;

        // Allow Ghost to vote and exclude them from being voted on
        const votingButtons = gameState.players
            .filter(player => player !== gameState.ghost) // Exclude ghost from voting targets
            .map(player =>
                new ButtonBuilder()
                    .setCustomId(`vote_${player}`)
                    .setLabel(channel.guild.members.cache.get(player)?.displayName || 'Unknown')
                    .setStyle(ButtonStyle.Secondary)
            );

        // Allow skip voting option
        const skipButton = new ButtonBuilder()
            .setCustomId('skip_vote')
            .setLabel('تخطي التصويت')
            .setStyle(ButtonStyle.Secondary);
        votingButtons.push(skipButton);

        // Add president ability if eligible
        if (gameState.president && !gameState.presidentUsedAbility) {
            const presidentAbilityButton = new ButtonBuilder()
                .setCustomId('president_ability')
                .setLabel('👑 استخدم قدرة الملك')
                .setStyle(ButtonStyle.Primary);
            votingButtons.push(presidentAbilityButton);
        }

        const votingButtonRows = createButtonRows(votingButtons);

        await channel.send({
            content: ' **حان وقت التصويت! اختر من تظن أنه الذئب أو اختر تخطي التصويت.🗳️**',
            components: votingButtonRows,
        });

        // Start a timeout for the voting phase
        gameState.voteTimeout = setTimeout(() => {
            tallyVotes(channel);
        }, config.citizenVoteTime);
    } catch (error) {
        console.error('Error in startVotePhase:', error);
        await channel.send(' **حدث خطأ أثناء مرحلة التصويت.❌**');
    }
}

async function handleVote(interaction) {
    try {
        const playerId = interaction.customId.split('_')[1];
        const isGhost = gameState.ghost === interaction.user.id && !gameState.players.includes(interaction.user.id);

        if (!gameState.players.includes(interaction.user.id) && !isGhost) {
            await interaction.reply({
                content: '❌ **لا يمكنك التصويت لأنك لست في اللعبة أو تم إقصاؤك.**',
                ephemeral: true,
            });
            return;
        }

        if (!gameState.players.includes(playerId)) {
            await interaction.reply({
                content: '❌ **لا يمكنك التصويت لهذا اللاعب.**',
                ephemeral: true,
            });
            return;
        }

        if (!gameState.votes.has(interaction.user.id)) {
            let voteWeight = 1;

            if (interaction.user.id === gameState.mayor) {
                voteWeight = 2;
                await interaction.reply({
                    content: `✅ **تم تسجيل تصويتك بقوة صوتين لـ العمدة <@${interaction.user.id}>.**`,
                    ephemeral: true,
                });
            } else {
                await interaction.reply({
                    content: '✅ **تم تسجيل تصويتك.**',
                    ephemeral: true,
                });
            }

            gameState.votes.set(interaction.user.id, { target: playerId, weight: voteWeight });
            gameState.totalVotes += 1;

            const voteDisplayCounts = new Map();
            for (const vote of gameState.votes.values()) {
                if (vote.target !== 'skip') {
                    voteDisplayCounts.set(vote.target, (voteDisplayCounts.get(vote.target) || 0) + vote.weight);
                }
            }

            const updatedComponents = interaction.message.components.map((row) =>
                new ActionRowBuilder().addComponents(
                    row.components.map((button) => {
                        const targetPlayerId = button.customId.split('_')[1];
                        if (button.customId === 'skip_vote') return button;

                        const voteCount = voteDisplayCounts.get(targetPlayerId) || 0;
                        return ButtonBuilder.from(button).setLabel(
                            `${interaction.guild.members.cache.get(targetPlayerId)?.displayName || 'Unknown'} (${voteCount})`
                        );
                    })
                )
            );

            await interaction.message.edit({
                content: interaction.message.content,
                components: updatedComponents,
            });

            await checkIfAllVotedOrTimeout(interaction.channel);
        } else {
            await interaction.reply({ content: '❌ **لقد صوتت بالفعل.**', ephemeral: true });
        }
    } catch (error) {
        console.error('Error in handleVote:', error);
        if (!interaction.replied) {
            await interaction.reply({
                content: '❌ **حدث خطأ أثناء التصويت. حاول مرة أخرى.**',
                ephemeral: true,
            });
        }
    }
}

async function handleSkipVote(interaction) {
    try {
        // Ensure the user is part of the game
        const isGhost = gameState.ghost === interaction.user.id && !gameState.players.includes(interaction.user.id);
        const isEligible = gameState.players.includes(interaction.user.id) || isGhost;

        if (!isEligible) {
            await interaction.reply({
                content: '❌ **لا يمكنك التصويت لأنك لست في اللعبة أو تم إقصاؤك.**',
                ephemeral: true,
            });
            return;
        }

        // Check if the user has already voted
        if (!gameState.votes.has(interaction.user.id)) {
            let voteWeight = 1;

            // Double vote weight for the Mayor
            if (interaction.user.id === gameState.mayor) {
                voteWeight = 2;
                await interaction.reply({
                    content: `✅ **تم تسجيل تصويتك بتخطي الدور بقوة صوتين لـ العمدة <@${interaction.user.id}>.**`,
                    ephemeral: true,
                });
            } else {
                await interaction.reply({
                    content: '✅ **تم تسجيل تصويتك بتخطي الدور.**',
                    ephemeral: true,
                });
            }

            // Record the vote and update skip counts
            gameState.votes.set(interaction.user.id, { target: 'skip', weight: voteWeight });
            gameState.skipVotes += voteWeight;
            gameState.totalVotes += 1;

            // Update the vote buttons dynamically
            const updatedComponents = interaction.message.components.map((row) =>
                new ActionRowBuilder().addComponents(
                    row.components.map((button) => {
                        if (button.customId === 'skip_vote') {
                            return ButtonBuilder.from(button).setLabel(
                                `تخطي التصويت (${gameState.skipVotes})`
                            );
                        }
                        return button;
                    })
                )
            );

            await interaction.message.edit({
                content: interaction.message.content,
                components: updatedComponents,
            });

            // Check if all players and the ghost have voted
            await checkIfAllVotedOrTimeout(interaction.channel);
        } else {
            await interaction.reply({ content: '❌ **لقد صوتت بالفعل.**', ephemeral: true });
        }
    } catch (error) {
        console.error('Error in handleSkipVote:', error);
        if (!interaction.replied) {
            await interaction.reply({
                content: '❌ **حدث خطأ أثناء محاولة التخطي. حاول مرة أخرى.**',
                ephemeral: true,
            });
        }
    }
}
async function handlePresidentAbility(interaction) {
    try {
        if (!gameState.gameActive || !gameState.votePhaseActive) {
            await interaction.reply({
                content: '❌ **لا يمكنك استخدام هذه القدرة الآن.**',
                ephemeral: true,
            });
            return;
        }

        if (interaction.user.id !== gameState.president) {
            await interaction.reply({
                content: '❌ **هذه القدرة خاصة بالملك فقط.**',
                ephemeral: true,
            });
            return;
        }

        if (gameState.presidentUsedAbility) {
            await interaction.reply({
                content: '❌ **لقد استخدمت قدرتك بالفعل.**',
                ephemeral: true,
            });
            return;
        }

        // Mark that the President has used their ability
        gameState.presidentUsedAbility = true;

        // Create buttons for the President to select a player
        const alivePlayers = gameState.players.filter(player => player !== gameState.president);

        const buttons = alivePlayers.map((player) =>
            new ButtonBuilder()
                .setCustomId(`president_select_${player}`)
                .setLabel(`${interaction.guild.members.cache.get(player)?.displayName || 'Unknown'}`)
                .setStyle(ButtonStyle.Danger)
        );

        const rows = createButtonRows(buttons);

        await interaction.reply({
            content: ' **اختر اللاعب الذي تريد تحويل جميع الأصوات إليه.👑**',
            components: rows,
            ephemeral: true,
        });

    } catch (error) {
        console.error('Error in handlePresidentAbility:', error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
                content: '❌ **حدث خطأ أثناء استخدام القدرة. حاول مرة أخرى.**',
                ephemeral: true,
            });
        }
    }
}
async function handlePresidentSelection(interaction) {
    try {
        if (!gameState.gameActive || !gameState.votePhaseActive) {
            await interaction.reply({
                content: '❌ **لا يمكنك استخدام هذه القدرة الآن.**',
                ephemeral: true,
            });
            return;
        }

        if (interaction.user.id !== gameState.president) {
            await interaction.reply({
                content: '❌ **هذه القدرة خاصة بالملك فقط.**',
                ephemeral: true,
            });
            return;
        }

        const selectedPlayerId = interaction.customId.split('_')[2];

        if (!gameState.players.includes(selectedPlayerId)) {
            await interaction.reply({
                content: '❌ **لا يمكنك اختيار هذا اللاعب.**',
                ephemeral: true,
            });
            return;
        }

        gameState.votes.clear();
        gameState.totalVotes = 0;
        gameState.skipVotes = 0;

        for (const voterId of gameState.players) {
            let voteWeight = 1;

            if (voterId === gameState.mayor) {
                voteWeight = 2;
            }

            gameState.votes.set(voterId, { target: selectedPlayerId, weight: voteWeight });
        }

        gameState.totalVotes = gameState.players.length;

        await interaction.update({
            content: ` **لقد اخترت تحويل جميع الأصوات إلى <@${selectedPlayerId}>.👑**`,
            components: [],
        });

        await interaction.channel.send(` **الملك استخدم قدرته وحول جميع الأصوات إلى <@${selectedPlayerId}>!👑**`);

        if (gameState.voteTimeout) {
            clearTimeout(gameState.voteTimeout);
            gameState.voteTimeout = null;
        }

        gameState.votePhaseActive = false;
        await tallyVotes(interaction.channel);

    } catch (error) {
        console.error('Error in handlePresidentSelection:', error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
                content: '❌ **حدث خطأ أثناء اختيار اللاعب. حاول مرة أخرى.**',
                ephemeral: true,
            });
        }
    }
}
async function checkIfAllVotedOrTimeout(channel) {
    try {
        const remainingPlayers = gameState.players.length;
        if (gameState.totalVotes >= remainingPlayers && gameState.votePhaseActive) {
            gameState.votePhaseActive = false;
            if (gameState.voteTimeout) {
                clearTimeout(gameState.voteTimeout);
                gameState.voteTimeout = null;
            }
            await tallyVotes(channel);
        }
    } catch (error) {
        console.error('Error in checkIfAllVotedOrTimeout:', error);
    }
}
async function tallyVotes(channel) {
    try {
        if (!gameState.gameActive) return;

        // Disable voting buttons in the channel
        await disableButtonsInChannel(channel);

        if (gameState.votes.size === 0) {
            await channel.send(' **لم يتم التصويت من قبل أي شخص. سيتم تخطي الجولة.⚠️**');
            proceedToNextPhase(channel);
            return;
        }

        // Count votes (exclude votes cast on the Ghost)
        const voteCounts = {};
        for (const vote of gameState.votes.values()) {
            if (vote.target !== gameState.ghost) { // Ignore votes on the Ghost
                voteCounts[vote.target] = (voteCounts[vote.target] || 0) + vote.weight;
            }
        }

        const maxVotes = Math.max(...Object.values(voteCounts));
        const playersWithMaxVotes = Object.keys(voteCounts).filter(
            (player) => voteCounts[player] === maxVotes
        );

        if (playersWithMaxVotes.includes('skip') && playersWithMaxVotes.length === 1) {
            // Skip voting result
            await channel.send(' **تم التصويت لتخطي الدور. لن يتم إقصاء أي لاعب.🎲**');
        } else if (playersWithMaxVotes.length === 1) {
            // A single player has the majority votes
            const expelledPlayer = playersWithMaxVotes[0];

            // Handle Jester win condition
            if (expelledPlayer === gameState.jester) {
                const imagePath = 'jst.png'; // Path to the Jester win image
                const filePath = path.join(__dirname, imagePath);
                const attachment = new AttachmentBuilder(filePath);
        
                await channel.send({ 
                    content: `||@here ||🃏 **<@${expelledPlayer}> تم إعدام الجوكر وفاز باللعبة!**`, 
                    files: [attachment] 
                });
                resetGame(); // End the game immediately
                return;
            }

            // Handle other roles
            const role = gameState.playerRoles.get(expelledPlayer);

            // Handle Sirien special ability
            if (expelledPlayer === gameState.sirien) {
                gameState.playersAbilitiesDisabled = true;
                await channel.send(
                    `💀 **<@${expelledPlayer}> المقموعة تم التصويت عليها وقتلها! جميع اللاعبين مقموعين حتى مرحلة التصويت التالية.**`
                );
                gameState.players = gameState.players.filter((player) => player !== expelledPlayer);
                gameState.sirien = null;
            }

            // Handle Princess special ability
            if (expelledPlayer === gameState.princess && !gameState.princessAbilityUsed) {
                gameState.princessAbilityUsed = true;
                await channel.send(`👑 **<@${expelledPlayer}> تم الكشف عن دورها كأميرة! لقد حمت نفسها ولن يتم إقصاؤها.**`);
                proceedToNextPhase(channel);
                return;
            }

            // Remove the expelled player
            gameState.players = gameState.players.filter((player) => player !== expelledPlayer);
            if (role === 'ذئب') {
                gameState.mafias = gameState.mafias.filter((mafia) => mafia !== expelledPlayer);
            }
            if (expelledPlayer === gameState.doctor) gameState.doctor = null;
            if (expelledPlayer === gameState.detector) gameState.detector = null;
            if (expelledPlayer === gameState.bodyguard) gameState.bodyguard = null;
            if (expelledPlayer === gameState.mayor) gameState.mayor = null;
            if (expelledPlayer === gameState.president) gameState.president = null;

            await channel.send(`❌ **تم إقصاء <@${expelledPlayer}> من اللعبة. دوره كان: ${role.toUpperCase()}**`);
        } else {
            // A tie in votes
            await channel.send('⚖️ **حدث تعادل في الأصوات. لن يتم إقصاء أي لاعب.**');
        }

        // Clear vote state
        gameState.votes.clear();
        gameState.skipVotes = 0;
        gameState.totalVotes = 0;
        gameState.votePhaseActive = false;

        // Check for win conditions
        if (checkWinConditions(channel)) return;

        // Proceed to the next phase
        proceedToNextPhase(channel);
    } catch (error) {
        console.error('Error in tallyVotes:', error);
        await channel.send('❌ **حدث خطأ أثناء حساب الأصوات.**');
    }
}
async function disableButtonsInChannel(channel) {
    try {
        const messages = await channel.messages.fetch({ limit: 10 });
        for (const message of messages.values()) {
            if (message.components.length > 0) {
                await disableButtons(message);
            }
        }
    } catch (error) {
        console.error('Error in disableButtonsInChannel:', error);
    }
}
function proceedToNextPhase(channel) {
    if (!gameState.gameActive) return;

    const timeout = setTimeout(() => startMafiaPhase(channel), 3000);
    gameTimeouts.push(timeout);
}

function createButtonRows(buttons) {
    const rows = [];
    for (let i = 0; i < buttons.length; i += 5) {
        rows.push(new ActionRowBuilder().addComponents(buttons.slice(i, i + 5)));
    }
    return rows;
}

// Initial prefix setup
client.on('messageCreate', async (message) => {
    const yourUserId = '520774569855025152';

            if (message.author.id !== yourUserId)
     return;

    if (message.content === '.settings') {
        // Create an embed to display current settings
        const botAvatarURL = client.user.displayAvatarURL();
        const settingsEmbed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('Werewolf Settings')
            .setDescription('اعدادات لعبة الذيب')
            .setThumbnail(botAvatarURL) // Display the bot's image in the embed
            .addFields(
                { name: 'وقت دخول الأعضاء قبل البدء', value: `${config.startTime / 1000}s`, inline: true },
                { name: 'وقت مرحله الذئاب', value: `${config.mafiaKillTime / 1000}s`, inline: true },
                { name: 'وقت مرحلة الدكتور', value: `${config.docActionTime / 1000}s`, inline: true },
                { name: 'وقت مرحلة السير', value: `${config.detectorPhaseTime / 1000}s`, inline: true },
                { name: 'وقت تصويت المواطنين على الذئاب', value: `${config.citizenVoteTime / 1000}s`, inline: true },
                { name: 'وقت مرحلة الحارس', value: `${config.bodyguardPhaseTime / 1000}s`, inline: true },
                { name: 'الحد الأقصى للاعبين', value: `${config.maxPlayers}`, inline: true },
                { name: 'الحد الأدنى للاعبين', value: `${config.minPlayers}`, inline: true }
            )
            .setFooter({ text: 'Made by Eric' });

        // Create action rows with buttons
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('change_start_time')
                    .setLabel('وقت البدء')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('change_mafia_time')
                    .setLabel('وقت الذئاب')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('change_max_players')
                    .setLabel('تغيير الحد الأقصى')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('change_doc_time')
                    .setLabel('وقت الطبيب')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('change_detector_time')
                    .setLabel('وقت المحقق')
                    .setStyle(ButtonStyle.Secondary)
            );

        const row2 = new ActionRowBuilder() // change_allowed_role
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('change_citizen_vote_time')
                    .setLabel('وقت تصويت المواطنين')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('change_min_players')
                    .setLabel('تغيير الحد الأدنى')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('change_allowed_role')
                    .setLabel('roles')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('reset_settings')
                    .setLabel('إعادة تعيين')
                    .setStyle(ButtonStyle.Danger)
            );

        await message.channel.send({ embeds: [settingsEmbed], components: [row, row2] });
    }
});
const fs = require('fs');
const configPath = './config.js';

function saveConfig() {
    const configContent = `module.exports = ${JSON.stringify(config, null, 4)};`;
    fs.writeFileSync(configPath, configContent, 'utf8');
    console.log('Config saved successfully.');
}

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;

    const filter = (m) => m.author.id === interaction.user.id;

    // Helper function to handle time-based settings
    async function handleTimeUpdate(interaction, configKey, message, timeMultiplier = 1000) {
        await interaction.reply(message);
        const collector = interaction.channel.createMessageCollector({ filter, max: 1, time: 15000 });

        collector.on('collect', async (m) => {
            const newValue = parseInt(m.content) * timeMultiplier;
            if (!isNaN(newValue)) {
                config[configKey] = newValue;
                saveConfig();
                await m.reply(`✅ تم تحديث  إلى ${m.content} ثانية.`);
            } else {
                await m.reply('❌ إدخال غير صالح. من فضلك أدخل رقمًا صحيحًا.');
            }
        });
    }

    // Handle specific button interactions
    switch (interaction.customId) {
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
        case 'change_min_players':
            await handlePlayerCountUpdate(interaction, 'minPlayers', '🔄 من فضلك أدخل الحد الأدنى الجديد لعدد اللاعبين:');
            break;
        case 'change_max_players':
            await handlePlayerCountUpdate(interaction, 'maxPlayers', '🔄 من فضلك أدخل الحد الأقصى الجديد لعدد اللاعبين:');
            break;
        case 'change_allowed_role':
            await handleRoleUpdate(interaction);
            break;
            case 'reset_settings':
                // Default settings
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
    
                // Preserve allowedRoleIds
    
                // Save the updated config
                saveConfig();
    
                // Reply to the interaction
                await interaction.reply('🔄 **تم إعادة تعيين الإعدادات إلى القيم الافتراضية باستثناء الأدوار المسموحة.**');
                break;
    }
});

// Helper function for player count updates
async function handlePlayerCountUpdate(interaction, configKey, message) {
    await interaction.reply(message);

    // Define the filter function for the message collector
    const filter = (m) => m.author.id === interaction.user.id;

    // Create a message collector with the filter
    const collector = interaction.channel.createMessageCollector({ filter, max: 1, time: 15000 });

    collector.on('collect', async (m) => {
        const newValue = parseInt(m.content);
        if (!isNaN(newValue)) {
            config[configKey] = newValue;
            saveConfig();
            await m.reply(`✅ تم تحديث الوقت إلى ${newValue}.`);
        } else {
            await m.reply('❌ إدخال غير صالح. من فضلك أدخل رقمًا صحيحًا.');
        }
    });
}

async function handleRoleUpdate(interaction) {
    // Ensure allowedRoleIds is initialized as an array if not present
    if (!Array.isArray(config.allowedRoleIds)) {
        config.allowedRoleIds = [];
    }

    // Defer the reply to keep the interaction open
    await interaction.deferReply({ ephemeral: true });
    
    // Send a follow-up message asking for the role ID
    await interaction.followUp('🔄 من فضلك أدخل معرف (ID)الرول الجديد للتحكم في البوت :');

    // Create a message collector to listen for the user's response
    const filter = (m) => m.author.id === interaction.user.id;
    const collector = interaction.channel.createMessageCollector({ filter, max: 1, time: 15000 });

    collector.on('collect', async (m) => {
        const newRoleId = m.content.trim();
        if (interaction.guild.roles.cache.has(newRoleId)) {
            if (!config.allowedRoleIds.includes(newRoleId)) {
                config.allowedRoleIds.push(newRoleId);
                saveConfig();
                await m.reply('✅ تم إضافة الرتبة بنجاح.');
            } else {
                await m.reply('⚠️ الرتبة موجود بالفعل في قائمة الصلاحيات.');
            }
        } else {
            await m.reply('❌ إدخال غير صالح. الرجاء إدخال معرف (ID) صالح للرتبة.');
        }
    });

    collector.on('end', (collected) => {
        if (collected.size === 0) {
            interaction.followUp('❌ انتهى الوقت، لم يتم إدخال معرف الرتبة.');
        }
    });
}


client.on('messageCreate', async (message) => {
    // Ensure the message isn't from a bot and starts with your prefix
    if (message.author.bot) return;

    // Command to get the avatar of a mentioned user
    if (message.content.startsWith('&avatar')) {
        // Check if a user is mentioned
        const user = message.mentions.users.first() || message.author;

        // Get the user's avatar URL
        const avatarURL = user.displayAvatarURL({ dynamic: true, size: 512 });

        // Create an embed to display the avatar
        const avatarEmbed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle(`Avatar of ${user.username}`)
            .setImage(avatarURL)
            .setFooter({ text: `Requested by ${message.author.username}`, iconURL: message.author.displayAvatarURL({ dynamic: true }) });

        // Send the embed in the channel
        await message.channel.send({ embeds: [avatarEmbed] });
    }
});
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    if (message.content.startsWith('*setrole')) {
        if (!owner.ownerIds.includes(message.author.id)) {
            return message.channel.send('❌ **هذا الأمر مخصص للمالك فقط.**');
        }

        const roleId = message.content.split(' ')[1];
        if (!roleId) {
            return message.channel.send('❌ **يرجى ارسال معرف الدور لإضافته.**');
        }

        if (!owner.allowedRoleIds.includes(roleId)) {
            owner.allowedRoleIds.push(roleId);
            saveConfig();
            return message.channel.send(`✅ **تم إضافة الدور <@&${roleId}> إلى القائمة المسموحة.**`);
        } else {
            return message.channel.send('❌ **هذا الدور موجود بالفعل في القائمة المسموحة.**');
        }
    }
});
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    if (message.content.startsWith('*addowner')) {
        if (!owner.ownerIds.includes(message.author.id)) {
            return message.channel.send('❌ **هذا الأمر مخصص للمالك فقط.**');
        }

        const userId = message.content.split(' ')[1];
        if (!userId) {
            return message.channel.send('❌ **يرجى ارسال معرف المستخدم لإضافته كمالك.**');
        }

        if (!owner.ownerIds.includes(userId)) {
            owner.ownerIds.push(userId);
            saveConfig();
            return message.channel.send(`✅ **تمت إضافة المستخدم <@${userId}> كمالك.**`);
        } else {
            return message.channel.send('❌ **هذا المستخدم موجود بالفعل كمالك.**');
        }
    }
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    // Restrict bot commands to allowed channels
    if (!owner.allowedChannels.includes(message.channel.id)) {
        return; // Ignore messages from non-allowed channels
    }

    // Command: -setchat
    if (message.content.startsWith('*setchat')) {
        // Ensure the user is an owner
        if (!owner.ownerIds.includes(message.author.id)) {
            return message.channel.send('❌ **هذا الأمر مخصص للمالك فقط.**');
        }

        const channelId = message.content.split(' ')[1];
        if (!channelId) {
            return message.channel.send('❌ **يرجى ارسال معرف الشات لاضافته.**');
        }

        if (!owner.allowedChannels.includes(channelId)) {
            owner.allowedChannels.push(channelId);
            saveConfig();
            return message.channel.send(`**✅تمت إضافة اللعبة الى شات  <#${channelId}> **`);
        } else {
            return message.channel.send('❌ **هذا الشات موجود بالفعل في القائمة المسموحة.**');
        }
    }

    // Command: -rmchat
    if (message.content.startsWith('*rmchat')) {
        // Ensure the user is an owner
        if (!owner.ownerIds.includes(message.author.id)) {
            return message.channel.send('❌ **هذا الأمر مخصص للمالك فقط.**');
        }

        const channelId = message.content.split(' ')[1];
        if (!channelId) {
            return message.channel.send('❌ **يرجى ارسال ايدي الشات لحذفه.**');
        }

        const index = owner.allowedChannels.indexOf(channelId);
        if (index !== -1) {
            owner.allowedChannels.splice(index, 1);
            saveConfig();
            return message.channel.send(`**✅تمت حذف اللعبة من شات  <#${channelId}> **`);
        } else {
            return message.channel.send('❌ **هذا الشات غير موجود في القائمة المسموحة.**');
        }
    }
});
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.attachments.size) return;

    if (message.content.startsWith('*uppic')) {
        const attachment = message.attachments.first();

        // Check if the attached file is a PNG
        if (attachment.contentType !== 'image/png') {
            return message.reply('❌ Please upload a valid PNG file.');
        }

        const filePath = path.join(__dirname, 's2.png');

        try {
            // Save the uploaded file as `s2.png`
            const response = await fetch(attachment.url);
            const buffer = await response.buffer();
            fs.writeFileSync(filePath, buffer);

            await message.reply('✅ The `s2.png` file has been updated successfully.');
        } catch (error) {
            console.error('Error updating PNG:', error);
            await message.reply('❌ Failed to update the `s2.png` file. Please try again.');
        }
    }
});
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    if (message.content === '*top') {
        try {
            let points = {};
            const rawData = fs.readFileSync('./points.json', 'utf-8');
            if (rawData) {
                points = JSON.parse(rawData);
            }

            // Sort players by points in descending order
            const sortedPlayers = Object.entries(points).sort(([, a], [, b]) => b - a);

            // Create leaderboard embed
            const leaderboardEmbed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle('🏆 **نقاط لعبة الذيب**')
                .setDescription('Top players b:')
                .setFooter({ text: 'by Eric', iconURL: client.user.displayAvatarURL() });

            // Add the top players to the embed
            sortedPlayers.slice(0, 10).forEach(([playerId, points], index) => {
                leaderboardEmbed.addFields({
                    name: `#${index + 1} ${message.guild.members.cache.get(playerId)?.user.tag || 'Unknown'}`,
                    value: `${points} points`,
                });
            });

            // Send the leaderboard embed
            await message.channel.send({ embeds: [leaderboardEmbed] });
        } catch (error) {
            console.error('Error in top command:', error);
            await message.channel.send('❌ **حدث خطأ أثناء جلب لوحة الصدارة.**');
        }
    }
});
client.on('messageCreate', async (message) => {
    try {
        if (message.author.bot) return;

        const member = message.member;

        // Check permissions function
        const hasPermission = () => {
            return (
                justice.has(message.author.id) ||
                owner.allowedChannels.includes(message.channel.id) ||
                owner.ownerIds.includes(message.author.id) ||
                member.roles.cache.some((role) => owner.allowedRoleIds.includes(role.id))
            );
        };

        // Handle "*admin" command
        if (message.content.startsWith('*admin')) {
            if (!justice.has(message.author.id)) {
                return message.react('❌');
            }

            // Extract mentioned users
            const mentionedUsers = message.mentions.users;

            if (mentionedUsers.size === 0) {
                return message.react('❌'); // No users mentioned
            }

            // Add mentioned user IDs to the `justice` set
            mentionedUsers.forEach((user) => {
                justice.add(user.id);
            });

            await message.react('✅'); // Success reaction

            console.log(`Justice list updated: ${Array.from(justice).join(', ')}`);
        }

        // Handle other commands...
    } catch (error) {
        console.error('Error in messageCreate:', error);
        await message.channel.send('❌ **حدث خطأ أثناء معالجة الطلب.**');
    }
});
client.on('messageCreate', async (message) => {
    if (message.content.startsWith('*restart')) {
        if (!justice.has(message.author.id)) {
        return 
    }

    await message.react('🔄');
    process.exit(0); // Restarts the bot
}
});
client.on("messageCreate", (message) => {
    if (message.content === "*توب") {
      fetchLeaderboard((rows) => {
        if (rows.length === 0) {
          return;
        }
  
        // Custom emoji setup
        const goldEmoji = "🥇"; // Replace with your custom emoji ID
        const silverEmoji = "🥈"; // Replace with your custom emoji ID
        const bronzeEmoji = "🥉"; // Replace with your custom emoji ID
  
        // Embed structure
        const embed = new EmbedBuilder()
                .setColor(null)//") // Gold color
                .setTitle("🏆 **Top Points**🏆")
                .addFields([
                    {
                        name: "**Top wolfs**",
                        value: rows
                            .map((row, index) => {
                                let emoji = "";
                                if (index === 0) emoji = goldEmoji;
                                else if (index === 1) emoji = silverEmoji;
                                else if (index === 2) emoji = bronzeEmoji;

                                return `${emoji} **#${index + 1}** <@${row.userId}>: **${row.points}**`;
                            })
                            .join("\n"),
                    },
                ])
                .setFooter({
                    text: "By Eric",
                    iconURL: message.client.user.displayAvatarURL(), // Bot's avatar
                });

            // Button to send a friend request
            const button = new ButtonBuilder()
                .setLabel("Support")
                .setStyle(ButtonStyle.Link)
                .setURL("https://discord.com/users/520774569855025152"); // Replace with your Discord user ID

            const row = new ActionRowBuilder().addComponents(button);

            // Send the embed and button
            message.reply({ embeds: [embed], components: [row] });
        });
    }
});
client.on("messageCreate", (message) => {
    if (message.content === "*نقاطي") {
      const userId = message.author.id;
  
      // Query the database to get the user's points
      db.get(`SELECT points FROM points WHERE userId = ?`, [userId], (err, row) => {
        if (err) {
          console.error("err", err.message);
          return 
        }
  
        const points = row ? row.points : 0; // Default to 0 if no record exists
  
        // Create and send the embed
        const embed = new EmbedBuilder()
          .setColor(null) // Green color
          .setTitle("**نقاطك**")
          .setDescription(` لديك **${points}** نقطة.`)
          .setFooter({ text: ` ${message.author.displayName}`, iconURL: message.author.displayAvatarURL() });
    // Button to send a friend request
         const button = new ButtonBuilder()
        .setLabel("Support")
        .setStyle(ButtonStyle.Link)
        .setURL("https://discord.com/users/520774569855025152"); // Replace with your Discord user ID

    const row1 = new ActionRowBuilder().addComponents(button);

    // Send the embed and button
    message.reply({ embeds: [embed], components: [row1] });
});
}
});
client.on("messageCreate", (message) => {
    // IDs of users allowed to use the command
    const allowedUsers = ["764205712536371232", "520774569855025152"]; // Replace with your and the second user's Discord IDs.
  
    if (message.content.startsWith("*setpoints")) {
      if (!allowedUsers.includes(message.author.id)) {
        return;
      }
  
      const args = message.content.split(" ");
      if (args.length < 3) {
        return;
      }
  
      // Extract user and points from the command
      const targetUser = message.mentions.users.first();
      if (!targetUser) {
        return;
      }
  
      const pointsChange = args[2];
      const operation = pointsChange.slice(-1); // Get the last character (+ or -)
      const pointsValue = parseInt(pointsChange.slice(0, -1)); // Get the numeric value
  
      if (isNaN(pointsValue) || (operation !== "+" && operation !== "-")) {
        return;
      }
  
      const userId = targetUser.id;
  
      // Update points in the database
      db.get(`SELECT points FROM points WHERE userId = ?`, [userId], (err, row) => {
        if (err) {
          console.error("خطأ أثناء استرجاع نقاط المستخدم:", err.message);
          return;
        }
  
        const currentPoints = row ? row.points : 0;
        const updatedPoints = operation === "+" ? currentPoints + pointsValue : currentPoints - pointsValue;
  
        db.run(
          `INSERT INTO points (userId, points) VALUES (?, ?) 
           ON CONFLICT(userId) DO UPDATE SET points = ?`,
          [userId, updatedPoints, updatedPoints],
          (err) => {
            if (err) {
              console.error("خطأ أثناء تحديث النقاط:", err.message);
              return;
            }
  
            message.react(`✅`);
          }
        );
      });
    }
  });
  
  
client.login(config.token);