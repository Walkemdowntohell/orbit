// ORBIT FINAL BOT (ULTIMATE)

const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  PermissionsBitField,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType
} = require('discord.js');

const fs = require('fs');

const client = new Client({
  intents: Object.values(GatewayIntentBits),
  partials: Object.values(Partials)
});

// TOKEN (UNCHANGED - YOU KEEP YOUR OWN)
const TOKEN = "MTQ5MTE4MDM3MjM2MzQ0ODM0MA.G89hU9.CA8ZMQnAIY_Tdq0_09-Ja9KVAIBIFqc-dBXVV8";

/* =========================
   FIXED DATABASE (NO SQLITE3)
   ========================= */
const dbStore = new Map();

const db = {
  get: (query, params, cb) => {
    const userId = params?.[0];

    if (query.includes("FROM clock WHERE user_id")) {
      const value = dbStore.get(userId);
      return cb(null, value ? { user_id: userId, start_time: value } : undefined);
    }

    return cb(null, undefined);
  },

  run: (query, params, cb = () => {}) => {
    const userId = params?.[0];
    const data = params?.[1];

    if (query.includes("INSERT OR REPLACE INTO clock")) {
      dbStore.set(userId, data);
    }

    if (query.includes("DELETE FROM clock")) {
      dbStore.delete(userId);
    }

    cb(null);
  },

  all: (query, params, cb) => {
    if (query.includes("FROM clock")) {
      const rows = [];

      for (const [user_id, start_time] of dbStore.entries()) {
        rows.push({ user_id, start_time });
      }

      return cb(null, rows);
    }

    return cb(null, []);
  }
};

// CONFIG
const ADMIN_ROLE = "1489595006204514404";
const OWNER_ID = "384982892259966976";
const VIEW_ROLE = "1489592175183401052";

const PURCHASE_CAT = "1490069296154677338";
const SUPPORT_CAT = "1490069269143355432";

const PANEL_FILE = "./panel.json";

// CLOCK CODES
const CLOCK_CODES = ["ORBIT-001","ORBIT-002","ORBIT-003","ORBIT-004","ORBIT-005"];

// LOG CHANNELS
const JOIN_LOG = "1490047167992430694";
const LEAVE_LOG = "1490047194198315179";
const CLOCK_LOG = "1491168880352169994";
const TRANSCRIPT_LOG = "1491168996114829495";
const COMMAND_LOG = "1491169587046125700";
const PUNISH_LOG = "1491169609024409801";
const BOT_LOG = "1491168960068976770";

// HELPERS
function hasAccess(member) {
  return member.roles.cache.has(ADMIN_ROLE) || member.id === OWNER_ID;
}

function embed(title, desc) {
  return new EmbedBuilder()
    .setTitle(title)
    .setDescription(desc)
    .setColor(0xADD8E6)
    .setTimestamp();
}

function log(channelId, emb) {
  const ch = client.channels.cache.get(channelId);
  if (ch) ch.send({ embeds: [emb] }).catch(() => {});
}

// READY
client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
  client.user.setPresence({
    status: 'dnd',
    activities: [{ name: 'orders for Discord server & website', type: 3 }]
  });
});

// JOIN / LEAVE
client.on('guildMemberAdd', m => log(JOIN_LOG, embed('Join', m.user.tag)));
client.on('guildMemberRemove', m => log(LEAVE_LOG, embed('Leave', m.user.tag)));

// INTERACTIONS
client.on('interactionCreate', async (interaction) => {
  try {

    log(BOT_LOG, embed('Interaction', `${interaction.user.tag}`));

    if (interaction.isChatInputCommand()) {

      if (!hasAccess(interaction.member)) {
        return interaction.reply({ content: 'No permission', ephemeral: true });
      }

      await interaction.deferReply();

      log(COMMAND_LOG, embed('Command', `${interaction.user.tag} → ${interaction.commandName}`));

      // PANEL
      if (interaction.commandName === 'panel') {

        if (fs.existsSync(PANEL_FILE)) {
          try {
            const data = JSON.parse(fs.readFileSync(PANEL_FILE));

            const channel = await client.channels.fetch(data.channelId);
            const msg = await channel.messages.fetch(data.messageId);

            if (msg) {
              return interaction.editReply({ content: 'Panel already sent' });
            }
          } catch {}
        }

        const menu = new StringSelectMenuBuilder()
          .setCustomId('ticket_select')
          .addOptions([
            {
              label: 'Purchase',
              description: 'Purchase form Orbit Support',
              value: 'purchase',
              emoji: '1490061035858821311'
            },
            {
              label: 'Support',
              description: 'Get support from Orbit Support',
              value: 'support',
              emoji: '1490061035858821311'
            }
          ]);

        const sentMsg = await interaction.editReply({
          embeds: [embed('Ticket Panel', 'Select an option below')],
          components: [new ActionRowBuilder().addComponents(menu)]
        });

        fs.writeFileSync(PANEL_FILE, JSON.stringify({
          channelId: interaction.channel.id,
          messageId: sentMsg.id
        }));
      }

      // CLOCK IN
      if (interaction.commandName === 'clockin') {

        const code = interaction.options.getString('code');

        if (!CLOCK_CODES.includes(code)) {
          return interaction.editReply({ content: 'Invalid code' });
        }

        db.get(`SELECT * FROM clock WHERE start_time LIKE ?`, [`%"code":"${code}"%`], (err, row) => {

          if (row && row.user_id !== interaction.user.id) {
            return interaction.editReply({ content: 'Code already in use' });
          }

          db.run(`INSERT OR REPLACE INTO clock VALUES (?, ?)`, [
            interaction.user.id,
            JSON.stringify({ code: code, time: Date.now() })
          ]);

          log(CLOCK_LOG, embed('Clock In', `${interaction.user.tag} → ${code}`));

          return interaction.editReply({
            embeds: [embed('Clock In', `${interaction.user.tag} using ${code}`)]
          });
        });
      }

      // CLOCK OUT
      if (interaction.commandName === 'clockout') {

        db.get(`SELECT * FROM clock WHERE user_id = ?`, [interaction.user.id], (err, row) => {

          if (!row) {
            return interaction.editReply({ content: 'You are not clocked in' });
          }

          const data = JSON.parse(row.start_time);
          const duration = Date.now() - data.time;
          const hours = (duration / 3600000).toFixed(2);

          db.run(`DELETE FROM clock WHERE user_id = ?`, [interaction.user.id]);

          log(CLOCK_LOG, embed('Clock Out', `${interaction.user.tag} worked ${hours}h (${data.code})`));

          return interaction.editReply({
            embeds: [embed('Clock Out', `Worked ${hours} hours`)]
          });
        });
      }

      // CLOCK PANEL
      if (interaction.commandName === 'clockpanel') {

        db.all(`SELECT * FROM clock`, [], (err, rows) => {

          if (!rows.length) {
            return interaction.editReply({ content: 'No active clock-ins' });
          }

          let desc = '';
          rows.forEach(r => {
            const data = JSON.parse(r.start_time);
            desc += `<@${r.user_id}> → ${data.code}\n`;
          });

          return interaction.editReply({
            embeds: [embed('Active Clock Codes', desc)]
          });
        });
      }
    }

    // TICKET CREATE
    if (interaction.isStringSelectMenu()) {

      if (interaction.customId !== 'ticket_select') return;

      await interaction.deferReply({ ephemeral: true });

      const existing = interaction.guild.channels.cache.find(c =>
        c.name.includes(interaction.user.username)
      );

      if (existing) {
        return interaction.editReply({ content: `You already have a ticket: ${existing}` });
      }

      const type = interaction.values[0];
      const category = type === 'purchase' ? PURCHASE_CAT : SUPPORT_CAT;

      const channel = await interaction.guild.channels.create({
        name: `${type === 'purchase' ? '🛒・purchase' : '🆘・support'}-${interaction.user.username}`,
        type: ChannelType.GuildText,
        parent: category,
        permissionOverwrites: [
          { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
          { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel] },
          { id: VIEW_ROLE, allow: [PermissionsBitField.Flags.ViewChannel] }
        ]
      });

      const msg =
        type === 'purchase'
          ? `🎟️ Purchase ticket created`
          : `🎟️ Support ticket created`;

      const closeBtn = new ButtonBuilder()
        .setCustomId('close_ticket')
        .setLabel('Close Ticket')
        .setStyle(ButtonStyle.Danger);

      await channel.send({
        embeds: [embed('Ticket Created', msg)],
        components: [new ActionRowBuilder().addComponents(closeBtn)]
      });

      await channel.send({
        embeds: [embed('Ticket Owner', `${interaction.user.tag}`)]
      });

      return interaction.editReply({ content: `Created ${channel}` });
    }

    // CLOSE
    if (interaction.isButton()) {

      if (interaction.customId === 'close_ticket') {

        if (!interaction.member.roles.cache.has(ADMIN_ROLE) && interaction.user.id !== OWNER_ID) {
          return interaction.reply({ content: 'Only staff can close tickets', ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });

        await interaction.channel.delete();
      }
    }

  } catch (err) {
    console.error(err);

    if (interaction.deferred) {
      interaction.editReply({ content: 'Error occurred' });
    } else {
      interaction.reply({ content: 'Error occurred', ephemeral: true });
    }
  }
});

client.login(TOKEN);
