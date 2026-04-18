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

const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');

const client = new Client({
  intents: Object.values(GatewayIntentBits),
  partials: Object.values(Partials)
});

const TOKEN = "MTQ5MTE4MDM3MjM2MzQ0ODM0MA.G89hU9.CA8ZMQnAIY_Tdq0_09-Ja9KVAIBIFqc-dBXVV8";

// DATABASE
const db = new sqlite3.Database('./data.db');

// CONFIG
const ADMIN_ROLE = "1489595006204514404";
const OWNER_ID = "384982892259966976";
const VIEW_ROLE = "1489592175183401052";

const PURCHASE_CAT = "1490069296154677338";
const SUPPORT_CAT = "1490069269143355432";

const PANEL_FILE = "./panel.json";

// 🔐 CLOCK CODES
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
    } catch {
      // message deleted → allow new panel
    }
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

      let msg = '';

if (type === 'purchase') {
  msg = `🎟️ **Ticket Created** ⚠️ If you’d like to make a purchase, please fill out the information below:

**Product:** (e.g. Roblox Script etc.)
*(Custom bot only):** (e.g. What freatures do u want ur bot to have?)
**Payment Method:** (e.g. Cashapp, PayPal)

Once completed, a staff member will review your request shortly.
Please make sure all information is accurate to avoid delays.
Thank you!`;
} else {
  msg = ` 🎟️ **Ticket Created** ⚠️ **For order delivery (purchased from our website), please provide:**

**Product:**
**Order ID / Email:**

---

⚠️ **For issues with a purchase, please provide:**

**Product:**
**Issue you're experiencing:**
**Where does the issue occur?:**
**Expected behavior:**
**What actually happened?:**
**Steps to reproduce (if any):**
**Screenshot/Video of the issue:**

---

⚠️ **Before submitting, please check our product status on our website.**

⏱️ **Response Time:**
We aim to respond within **1 hour**, but it may take up to **24 hours**.
On weekends or holidays, please allow up to **48 hours**.

Thank you for your patience!`;
}

      const closeBtn = new ButtonBuilder()
        .setCustomId('close_ticket')
        .setLabel('Close Ticket')
        .setStyle(ButtonStyle.Danger);

      await channel.send({
        embeds: [embed('Ticket Created', msg)],
        components: [new ActionRowBuilder().addComponents(closeBtn)]
      });

      // 👤 OWNER MESSAGE
      await channel.send({
        embeds: [embed('Ticket Owner', `${interaction.user.tag}`)]
      });

      return interaction.editReply({ content: `Created ${channel}` });
    }

    // CLOSE
    if (interaction.isButton()) {

      if (interaction.customId === 'close_ticket') {

        if (!interaction.member.roles.cache.has(ADMIN_ROLE) && interaction.user.id !== OWNER_ID) {
          return interaction.reply({
            content: 'Only staff can close tickets',
            ephemeral: true
          });
        }

        await interaction.deferReply({ ephemeral: true });

        const messages = await interaction.channel.messages.fetch({ limit: 100 });
        const content = messages.map(m => `${m.author.tag}: ${m.content}`).join('\n');

        const buffer = Buffer.from(content);

        const logCh = client.channels.cache.get(TRANSCRIPT_LOG);

        if (logCh) {
          await logCh.send({
            embeds: [embed('Ticket Closed', interaction.user.tag)],
            files: [{ attachment: buffer, name: 'transcript.html' }]
          });
        }

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