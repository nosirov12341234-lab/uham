"""
Username Hunter Bot - Professional Edition
"""

import asyncio
import sqlite3
import logging
import os
from telethon import TelegramClient, events, Button
from telethon.tl.types import User
from telethon.tl.functions.channels import CreateChannelRequest, UpdateUsernameRequest
from telethon.errors import (
    UsernameNotOccupiedError,
    UsernameInvalidError,
    FloodWaitError,
    UserDeactivatedError,
    UserDeactivatedBanError,
    SessionPasswordNeededError,
    PhoneCodeInvalidError,
    ChannelsAdminPublicTooMuchError,
)

# ─────────────────────────────────────────────
#  KONFIGURATSIYA
# ─────────────────────────────────────────────
API_ID    = 33682795
API_HASH  = '8b9998627b50fd424ac40a1c9690585d'
BOT_TOKEN = '8264242817:AAFuhQ7xsMkL846Tld4-1MeX-Hp3nsTvY5Q'
ADMIN_ID  = 7965397133

DB_FILE      = "hunter_tizimi.db"
SESSIONS_DIR = "sessions"
os.makedirs(SESSIONS_DIR, exist_ok=True)

# ─────────────────────────────────────────────
#  LOGGING
# ─────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler("hunter.log", encoding="utf-8"),
        logging.StreamHandler(),
    ],
)
log = logging.getLogger(__name__)

# ─────────────────────────────────────────────
#  BOT
# ─────────────────────────────────────────────
bot = TelegramClient("hunter_bot_session", API_ID, API_HASH)
connected_clients: dict = {}

# ─────────────────────────────────────────────
#  DATABASE
# ─────────────────────────────────────────────
def db_init():
    with sqlite3.connect(DB_FILE) as con:
        # Kuzatiladigan userlar
        con.execute("""
            CREATE TABLE IF NOT EXISTS userlar (
                tg_id    INTEGER PRIMARY KEY,
                username TEXT NOT NULL,
                ism      TEXT,
                status   TEXT DEFAULT 'Faol'
            )
        """)
        # Band qilingan userlar (kanal ochilganlar)
        con.execute("""
            CREATE TABLE IF NOT EXISTS band_userlar (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                username    TEXT NOT NULL,
                kanal_link  TEXT,
                akkaunt     TEXT,
                vaqt        DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)
        # Ulangan akkauntlar
        con.execute("""
            CREATE TABLE IF NOT EXISTS akkauntlar (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                telefon      TEXT UNIQUE NOT NULL,
                tg_id        INTEGER,
                username     TEXT,
                limit_tolgan INTEGER DEFAULT 0
            )
        """)
        # Sozlamalar
        con.execute("""
            CREATE TABLE IF NOT EXISTS sozlamalar (
                kalit  TEXT PRIMARY KEY,
                qiymat TEXT
            )
        """)
        con.execute("INSERT OR IGNORE INTO sozlamalar (kalit, qiymat) VALUES ('interval', '60')")
        con.commit()
    log.info("DB tayyor: %s", DB_FILE)


def db_insert_users_bulk(users):
    with sqlite3.connect(DB_FILE) as con:
        for row in users:
            con.execute(
                "INSERT OR IGNORE INTO userlar (tg_id, username, ism, status) VALUES (?,?,?,?)",
                row
            )
        con.commit()


def db_get_interval():
    with sqlite3.connect(DB_FILE) as con:
        row = con.execute("SELECT qiymat FROM sozlamalar WHERE kalit='interval'").fetchone()
        return int(row[0]) if row else 60


def db_set_interval(seconds):
    with sqlite3.connect(DB_FILE) as con:
        con.execute("INSERT OR REPLACE INTO sozlamalar (kalit,qiymat) VALUES ('interval',?)", (str(seconds),))
        con.commit()


def db_add_user(tg_id, username, ism):
    with sqlite3.connect(DB_FILE) as con:
        con.execute(
            "INSERT OR REPLACE INTO userlar (tg_id, username, ism, status) VALUES (?,?,?,'Faol')",
            (tg_id, username, ism)
        )
        con.commit()


def db_delete_user(identifier):
    with sqlite3.connect(DB_FILE) as con:
        try:
            tg_id = int(identifier)
            row = con.execute("SELECT tg_id FROM userlar WHERE tg_id=?", (tg_id,)).fetchone()
            if row:
                con.execute("DELETE FROM userlar WHERE tg_id=?", (tg_id,))
                con.commit()
                return True
        except ValueError:
            pass
        clean = identifier.lstrip("@").lower()
        row = con.execute("SELECT tg_id FROM userlar WHERE LOWER(username)=?", (clean,)).fetchone()
        if row:
            con.execute("DELETE FROM userlar WHERE tg_id=?", (row[0],))
            con.commit()
            return True
    return False


def db_all_users():
    with sqlite3.connect(DB_FILE) as con:
        return con.execute("SELECT tg_id, username, ism, status FROM userlar").fetchall()


def db_update_user_status(tg_id, status):
    with sqlite3.connect(DB_FILE) as con:
        con.execute("UPDATE userlar SET status=? WHERE tg_id=?", (status, tg_id))
        con.commit()


def db_update_user_username(tg_id, new_username):
    with sqlite3.connect(DB_FILE) as con:
        con.execute("UPDATE userlar SET username=? WHERE tg_id=?", (new_username, tg_id))
        con.commit()


def db_move_to_band(username, kanal_link, akkaunt):
    """Userni kuzatuv ro'yxatidan o'chirib, band ro'yxatiga qo'shadi."""
    with sqlite3.connect(DB_FILE) as con:
        # Kuzatuv ro'yxatidan o'chirish
        con.execute("DELETE FROM userlar WHERE LOWER(username)=?", (username.lower(),))
        # Band ro'yxatiga qo'shish
        con.execute(
            "INSERT INTO band_userlar (username, kanal_link, akkaunt) VALUES (?,?,?)",
            (username, kanal_link, akkaunt)
        )
        con.commit()


def db_all_band():
    with sqlite3.connect(DB_FILE) as con:
        return con.execute(
            "SELECT id, username, kanal_link, akkaunt, vaqt FROM band_userlar ORDER BY vaqt DESC"
        ).fetchall()


def db_add_account(telefon, tg_id, username):
    with sqlite3.connect(DB_FILE) as con:
        con.execute(
            "INSERT OR REPLACE INTO akkauntlar (telefon, tg_id, username, limit_tolgan) VALUES (?,?,?,0)",
            (telefon, tg_id, username)
        )
        con.commit()


def db_all_accounts():
    with sqlite3.connect(DB_FILE) as con:
        return con.execute(
            "SELECT id, telefon, tg_id, username, limit_tolgan FROM akkauntlar"
        ).fetchall()


def db_delete_account(telefon):
    with sqlite3.connect(DB_FILE) as con:
        row = con.execute("SELECT id FROM akkauntlar WHERE telefon=?", (telefon,)).fetchone()
        if row:
            sp = os.path.join(SESSIONS_DIR, telefon.replace("+", "") + ".session")
            if os.path.exists(sp):
                os.remove(sp)
            con.execute("DELETE FROM akkauntlar WHERE telefon=?", (telefon,))
            con.commit()
            return True
    return False


def db_set_limit(telefon, val):
    with sqlite3.connect(DB_FILE) as con:
        con.execute("UPDATE akkauntlar SET limit_tolgan=? WHERE telefon=?", (val, telefon))
        con.commit()


def db_reset_limits():
    with sqlite3.connect(DB_FILE) as con:
        con.execute("UPDATE akkauntlar SET limit_tolgan=0")
        con.commit()


# ─────────────────────────────────────────────
#  DASTLABKI USERLAR
# ─────────────────────────────────────────────
INITIAL_USERS = [
    (225924867,  "omonovna",         "Omonovna",        "Faol"),
    (464276004,  "yaqindaonlaynedi", "yaqindaonlaynedi","Faol"),
    (478430836,  "goat",             "Goatt",           "Faol"),
    (535420668,  "ozodaka",          "ozodaka",         "Faol"),
    (567026089,  "begmatov",         "begmatov",        "Faol"),
    (615843516,  "borzzz",           "Borzzz",          "Faol"),
    (643058425,  "sh_77",            "SH_77",           "Faol"),
    (702387592,  "skromny",          "Skromny",         "Faol"),
    (771375952,  "xurshidchik",      "Xurshidchik",     "Faol"),
    (830027231,  "grajdan",          "Grajdan",         "Faol"),
    (1058260210, "ii6ll2",           "ii6ll2",          "Faol"),
    (1075519591, "op_71",            "Op_71",           "Faol"),
    (1496680442, "hz_77",            "Hz_77",           "Faol"),
    (1664183072, "xolmuradov",       "Xolmuradov",      "Faol"),
    (1746570515, "matarola",         "Matarola",        "Faol"),
    (1774935982, "bankchi",          "Bankchi",         "Faol"),
    (1910332138, "nfchi",            "Nfchi",           "Faol"),
    (1934877494, "x69ph",            "x69ph",           "Faol"),
    (2085836979, "russx",            "russx",           "Faol"),
    (2134182945, "itmylife",         "Itmylife",        "Faol"),
    (5001437469, "xushbichim",       "Xushbichim",      "Faol"),
    (5073897636, "xolmurad",         "Xolmurad",        "Faol"),
    (5143503312, "chekmayman",       "Chekmayman",      "Faol"),
    (5253204084, "jungli",           "Jungli",          "Faol"),
    (5411877861, "begana",           "begana",          "Faol"),
    (5585881017, "xavayu",           "Xavayu",          "Faol"),
    (5625170156, "ozbema",           "ozbema",          "Faol"),
    (5687046111, "rolda",            "Rolda",           "Faol"),
    (5696108976, "kh001",            "kh001",           "Faol"),
    (5756079992, "onefree",          "onefree",         "Faol"),
    (5848639743, "medic",            "",                "Faol"),
    (5971506620, "maychi",           "Maychi",          "Faol"),
    (5986894341, "ozodbek_admin",    "",                "Faol"),
    (6001327019, "w1222",            "",                "Faol"),
    (6146565562, "roziqulov",        "Roziqulov",       "Faol"),
    (6341863538, "omonullaeva",      "Omonullaeva",     "Faol"),
    (6557842632, "abubek",           "Abubek",          "Faol"),
    (6717845633, "zsxce",            "Zsxce",           "Faol"),
    (6941085829, "ziqnaa",           "ZIQNAA",          "Faol"),
    (6998942470, "egamjon",          "Egamjon",         "Faol"),
    (7137756874, "menikiku",         "Menikiku",        "Faol"),
    (7198081828, "asliddinjon",      "Asliddinjon",     "Faol"),
    (7278285065, "holmuradov",       "Holmuradov",      "Faol"),
    (7318181057, "gujji",            "Gujji",           "Faol"),
    (7397770335, "bezopasni",        "bezopasni",       "Faol"),
    (7557077457, "tortishma",        "Tortishma",       "Faol"),
    (7650733100, "mamazita",         "Mamazita",        "Faol"),
    (7679140548, "uz_b0",            "Uz_b0",           "Faol"),
    (7713344878, "ozodbeksale",      "OZODBEKSALE",     "Faol"),
    (7725186753, "jekcittak",        "Jekcittak",       "Faol"),
    (7765818178, "ozodbei",          "Ozodbei",         "Faol"),
    (7807350839, "akezman",          "Akezman",         "Faol"),
    (7861809194, "knyazbe",          "knyazbe",         "Faol"),
    (8319957617, "rajabovO",         "RajabovO",        "Faol"),
]

# ─────────────────────────────────────────────
#  KLAVIATURA
# ─────────────────────────────────────────────
MAIN_KB = bot.build_reply_markup([
    [Button.text("👤 Userlar"),     Button.text("🔑 Akkauntlar")],
    [Button.text("🏁 Band qilinganlar"), Button.text("📊 Holat")],
    [Button.text("⚙️ Sozlamalar")],
])
USERS_KB = bot.build_reply_markup([
    [Button.text("➕ User qo'shish"),    Button.text("❌ Userni o'chirish")],
    [Button.text("📋 Userlar ro'yxati"), Button.text("🔙 Orqaga")],
])
ACCOUNTS_KB = bot.build_reply_markup([
    [Button.text("➕ Akkaunt ulash"),        Button.text("❌ Akkauntni o'chirish")],
    [Button.text("📋 Akkauntlar ro'yxati"),  Button.text("🔄 Limitni tiklash")],
    [Button.text("🔙 Orqaga")],
])


def is_admin(event):
    return event.sender_id == ADMIN_ID


# ─────────────────────────────────────────────
#  AKKAUNTLARNI YUKLASH
# ─────────────────────────────────────────────
async def load_accounts():
    rows = db_all_accounts()
    for _, telefon, tg_id, username, _ in rows:
        sp = os.path.join(SESSIONS_DIR, telefon.replace("+", ""))
        if not os.path.exists(sp + ".session"):
            log.warning("Session yo'q: %s", telefon)
            continue
        try:
            client = TelegramClient(sp, API_ID, API_HASH)
            await client.connect()
            if await client.is_user_authorized():
                connected_clients[tg_id] = client
                log.info("Akkaunt ulandi: %s @%s", telefon, username)
            else:
                await client.disconnect()
                log.warning("Avtorizatsiya yo'q: %s", telefon)
        except Exception as ex:
            log.exception("Yuklash xatosi [%s]: %s", telefon, ex)


# ─────────────────────────────────────────────
#  KANAL OCHISH
# ─────────────────────────────────────────────
async def open_channel_for_username(username: str) -> bool:
    accounts = db_all_accounts()
    if not accounts:
        await bot.send_message(
            ADMIN_ID,
            "⚠️ Hech qanday akkaunt ulanmagan!\nAvval akkaunt qo'shing.",
            buttons=MAIN_KB,
        )
        return False

    all_limited = True
    for _, telefon, tg_id, acc_uname, limit_tolgan in accounts:
        if limit_tolgan:
            continue
        all_limited = False

        client = connected_clients.get(tg_id)
        if not client:
            log.warning("Client topilmadi: %s", telefon)
            continue

        try:
            # Kanal ochish
            result = await client(CreateChannelRequest(
                title=username,
                about=f"@{username}",
                megagroup=False,
            ))
            channel = result.chats[0]
            await asyncio.sleep(2)

            # Username o'rnatish
            await client(UpdateUsernameRequest(channel, username))

            kanal_link = f"t.me/{username}"
            log.info("✅ Kanal ochildi: @%s | %s", username, telefon)

            # Band ro'yxatiga o'tkazish (kuzatuvdan o'chiriladi)
            db_move_to_band(username, kanal_link, telefon)

            await bot.send_message(
                ADMIN_ID,
                f"🏁 **@{username}** USERNAME BO'SHADI!\n\n"
                f"✅ Kanal muvaffaqiyatli ochildi!\n"
                f"🔗 Kanal: t.me/{username}\n"
                f"🔑 Akkaunt: `{telefon}`\n\n"
                f"📂 User kuzatuv ro'yxatidan o'chirildi va band qilinganlar ro'yxatiga qo'shildi.",
                buttons=MAIN_KB,
            )
            return True

        except ChannelsAdminPublicTooMuchError:
            log.warning("Limit to'ldi: %s", telefon)
            db_set_limit(telefon, 1)
            await bot.send_message(
                ADMIN_ID,
                f"⚠️ `{telefon}` akkauntida limit to'ldi!\n"
                f"Keyingi akkauntdan urinilmoqda...",
            )
            continue

        except FloodWaitError as e:
            log.warning("FloodWait kanal ochishda: %ds", e.seconds)
            await asyncio.sleep(e.seconds + 3)
            continue

        except Exception as ex:
            log.exception("Kanal ochish xatosi [%s]: %s", telefon, ex)
            continue

    if all_limited:
        await bot.send_message(
            ADMIN_ID,
            f"❌ **@{username}** bo'shadi, lekin\n"
            f"barcha akkauntlarda limit to'lgan!\n\n"
            f"Yangi akkaunt qo'shing yoki '🔄 Limitni tiklash' tugmasini bosing.",
            buttons=MAIN_KB,
        )
    return False


# ─────────────────────────────────────────────
#  TEKSHIRUV ENGINE
# ─────────────────────────────────────────────
async def check_engine():
    await asyncio.sleep(10)
    log.info("Check engine ishga tushdi.")

    while True:
        interval = db_get_interval()
        try:
            rows = db_all_users()
            for tg_id, username, ism, status in rows:
                if not username:
                    continue
                await asyncio.sleep(1.2)
                try:
                    entity = await bot.get_entity(username)

                    if isinstance(entity, User):
                        # Username o'zgardimi?
                        current = (entity.username or "").lower()
                        saved   = username.lower()
                        if current and current != saved:
                            # Eski username bo'shadi!
                            log.info("USERNAME O'ZGARDI, ESKI BO'SHADI: @%s -> @%s", username, entity.username)
                            db_update_user_username(tg_id, entity.username)
                            await bot.send_message(
                                ADMIN_ID,
                                f"⚠️ **{ism or username}** username'ni o'zgartirdi!\n"
                                f"🔹 Eski: @{username}\n"
                                f"🔸 Yangi: @{entity.username}\n\n"
                                f"🏹 Eski username band qilinmoqda...",
                            )
                            await open_channel_for_username(username)

                        # Akkaunt o'chirilganmi?
                        if entity.deleted:
                            log.info("Akkaunt o'chirildi: @%s", username)
                            db_update_user_status(tg_id, "O'chgan")
                            await bot.send_message(
                                ADMIN_ID,
                                f"🗑 **@{username}** akkauntini o'chirdi!\n"
                                f"🏹 Username band qilinmoqda...",
                            )
                            await open_channel_for_username(username)

                except (UsernameNotOccupiedError, UsernameInvalidError, ValueError):
                    # Username bo'shadi!
                    log.info("USERNAME BO'SHADI: @%s", username)
                    await bot.send_message(
                        ADMIN_ID,
                        f"🎯 **@{username}** USERNAME BO'SHADI!\n"
                        f"🏹 Kanal ochilmoqda...",
                    )
                    await open_channel_for_username(username)

                except (UserDeactivatedError, UserDeactivatedBanError):
                    log.info("Akkaunt deaktivatsiya: @%s", username)
                    db_update_user_status(tg_id, "O'chgan")
                    await bot.send_message(
                        ADMIN_ID,
                        f"🗑 **@{username}** akkauntini o'chirdi!\n"
                        f"🏹 Username band qilinmoqda...",
                    )
                    await open_channel_for_username(username)

                except FloodWaitError as e:
                    log.warning("FloodWait tekshiruvda: %ds", e.seconds)
                    await asyncio.sleep(e.seconds + 5)

                except Exception as ex:
                    log.exception("Tekshiruv xatosi [%s]: %s", username, ex)

        except Exception as ex:
            log.exception("Engine umumiy xato: %s", ex)

        await asyncio.sleep(interval)


# ─────────────────────────────────────────────
#  /start
# ─────────────────────────────────────────────
@bot.on(events.NewMessage(pattern="/start"))
async def cmd_start(event):
    if not is_admin(event):
        await event.reply("⛔️ Bu shaxsiy bot! Sizga foydalanishga ruxsat berilmagan.")
        return
    interval = db_get_interval()
    users    = db_all_users()
    accounts = db_all_accounts()
    band     = db_all_band()
    await event.reply(
        f"👋 **Username Hunter Bot**\n\n"
        f"👤 Kuzatilayotgan: **{len(users)}** ta user\n"
        f"🏁 Band qilingan: **{len(band)}** ta username\n"
        f"🔑 Akkauntlar: **{len(accounts)}** ta\n"
        f"⏱ Tekshirish: har **{interval}** soniyada\n\n"
        f"Username bo'shagan zahoti avtomatik kanal ochiladi!",
        buttons=MAIN_KB,
    )
    raise events.StopPropagation


# ─────────────────────────────────────────────
#  USERLAR BO'LIMI
# ─────────────────────────────────────────────
@bot.on(events.NewMessage(pattern="👤 Userlar"))
async def btn_users(event):
    if not is_admin(event): return
    count = len(db_all_users())
    await event.reply(f"👤 **Userlar bo'limi**\nJami: {count} ta user kuzatuvda", buttons=USERS_KB)


@bot.on(events.NewMessage(pattern="➕ User qo'shish"))
async def btn_add_user(event):
    if not is_admin(event): return
    async with bot.conversation(event.chat_id, timeout=120) as conv:
        try:
            await conv.send_message("🔗 Username kiriting (Masalan: @username):")
            msg      = await conv.get_response()
            username = msg.text.strip().lstrip("@")
            if not username:
                await conv.send_message("⚠️ Username bo'sh bo'lishi mumkin emas.", buttons=USERS_KB)
                return
            try:
                entity = await bot.get_entity(username)
                if isinstance(entity, User):
                    db_add_user(entity.id, entity.username or username, entity.first_name or username)
                    await conv.send_message(
                        f"✅ **@{entity.username or username}** kuzatuvga qo'shildi!",
                        buttons=USERS_KB,
                    )
                else:
                    await conv.send_message("⚠️ Bu guruh/kanal. Foydalanuvchi username kiriting.", buttons=USERS_KB)
            except (UsernameNotOccupiedError, UsernameInvalidError, ValueError):
                await conv.send_message(f"❌ @{username} topilmadi.", buttons=USERS_KB)
            except Exception as ex:
                await conv.send_message(f"⚠️ Xato: {str(ex)[:150]}", buttons=USERS_KB)
        except asyncio.TimeoutError:
            await bot.send_message(event.chat_id, "⏰ Vaqt tugadi.", buttons=USERS_KB)


@bot.on(events.NewMessage(pattern="❌ Userni o'chirish"))
async def btn_del_user(event):
    if not is_admin(event): return
    async with bot.conversation(event.chat_id, timeout=120) as conv:
        try:
            await conv.send_message("🗑 Username yoki ID kiriting:")
            msg = await conv.get_response()
            if db_delete_user(msg.text.strip()):
                await conv.send_message("✅ User kuzatuv ro'yxatidan o'chirildi!", buttons=USERS_KB)
            else:
                await conv.send_message("❌ Bunday user topilmadi.", buttons=USERS_KB)
        except asyncio.TimeoutError:
            await bot.send_message(event.chat_id, "⏰ Vaqt tugadi.", buttons=USERS_KB)


@bot.on(events.NewMessage(pattern="📋 Userlar ro'yxati"))
async def btn_list_users(event):
    if not is_admin(event): return
    rows = db_all_users()
    if not rows:
        await event.reply("📋 Kuzatuv ro'yxati bo'sh.", buttons=USERS_KB)
        return
    lines = [f"📋 **Kuzatiladigan userlar** ({len(rows)} ta):\n"]
    for i, (tg_id, username, ism, status) in enumerate(rows, 1):
        u = f"@{username}" if username else "_yo'q_"
        s = "🟢" if status == "Faol" else "🔴"
        lines.append(f"{i}. {s} {u}")
    text = "\n".join(lines)
    for i in range(0, len(text), 4000):
        await event.reply(text[i:i+4000], buttons=USERS_KB)


# ─────────────────────────────────────────────
#  BAND QILINGANLAR
# ─────────────────────────────────────────────
@bot.on(events.NewMessage(pattern="🏁 Band qilinganlar"))
async def btn_band(event):
    if not is_admin(event): return
    rows = db_all_band()
    if not rows:
        await event.reply("🏁 Hali hech qanday username band qilinmagan.", buttons=MAIN_KB)
        return
    lines = [f"🏁 **Band qilingan usernamlar** ({len(rows)} ta):\n"]
    for i, (bid, username, kanal_link, akkaunt, vaqt) in enumerate(rows, 1):
        lines.append(
            f"{i}. @{username}\n"
            f"   🔗 {kanal_link}\n"
            f"   🔑 {akkaunt}\n"
            f"   🕐 {vaqt[:16]}"
        )
    text = "\n\n".join(lines)
    for i in range(0, len(text), 4000):
        await event.reply(text[i:i+4000], buttons=MAIN_KB)


# ─────────────────────────────────────────────
#  AKKAUNTLAR BO'LIMI
# ─────────────────────────────────────────────
@bot.on(events.NewMessage(pattern="🔑 Akkauntlar"))
async def btn_accounts(event):
    if not is_admin(event): return
    count = len(db_all_accounts())
    await event.reply(f"🔑 **Akkauntlar bo'limi**\nJami: {count} ta akkaunt", buttons=ACCOUNTS_KB)


@bot.on(events.NewMessage(pattern="➕ Akkaunt ulash"))
async def btn_add_account(event):
    if not is_admin(event): return
    async with bot.conversation(event.chat_id, timeout=300) as conv:
        try:
            await conv.send_message("📱 Telefon raqam kiriting (+998901234567):")
            phone_msg = await conv.get_response()
            telefon   = phone_msg.text.strip()

            if not telefon.startswith("+"):
                await conv.send_message("⚠️ Raqam + bilan boshlanishi kerak.", buttons=ACCOUNTS_KB)
                return

            sp     = os.path.join(SESSIONS_DIR, telefon.replace("+", ""))
            client = TelegramClient(sp, API_ID, API_HASH)
            await client.connect()
            await client.send_code_request(telefon)

            await conv.send_message(
                "📨 Telegram'ga kod yuborildi!\n\n"
                "✏️ Kodni kiriting (bo'sh joy bilan ham yozsa bo'ladi):"
            )
            code_msg = await conv.get_response()
            code     = code_msg.text.strip().replace(" ", "")

            try:
                await client.sign_in(telefon, code)
            except SessionPasswordNeededError:
                await conv.send_message("🔐 2FA parolini kiriting:")
                pass_msg = await conv.get_response()
                await client.sign_in(password=pass_msg.text.strip())
            except PhoneCodeInvalidError:
                await conv.send_message("❌ Kod noto'g'ri. Qaytadan urinib ko'ring.", buttons=ACCOUNTS_KB)
                await client.disconnect()
                return

            me = await client.get_me()
            db_add_account(telefon, me.id, me.username or "")
            connected_clients[me.id] = client

            log.info("Akkaunt ulandi: %s @%s", telefon, me.username)
            await conv.send_message(
                f"✅ Akkaunt muvaffaqiyatli ulandi!\n\n"
                f"👤 Ism: **{me.first_name}**\n"
                f"🔗 @{me.username or 'username_yoq'}\n"
                f"📱 `{telefon}`",
                buttons=ACCOUNTS_KB,
            )
        except asyncio.TimeoutError:
            await bot.send_message(event.chat_id, "⏰ Vaqt tugadi (5 daqiqa).", buttons=ACCOUNTS_KB)
        except Exception as ex:
            log.exception("Akkaunt ulash: %s", ex)
            await bot.send_message(event.chat_id, f"⚠️ Xato: {str(ex)[:200]}", buttons=ACCOUNTS_KB)


@bot.on(events.NewMessage(pattern="❌ Akkauntni o'chirish"))
async def btn_del_account(event):
    if not is_admin(event): return
    async with bot.conversation(event.chat_id, timeout=120) as conv:
        try:
            await conv.send_message("📱 O'chirmoqchi bo'lgan akkaunt telefon raqamini kiriting:")
            msg     = await conv.get_response()
            telefon = msg.text.strip()
            if db_delete_account(telefon):
                await conv.send_message(f"✅ `{telefon}` akkaunt o'chirildi!", buttons=ACCOUNTS_KB)
            else:
                await conv.send_message("❌ Bunday akkaunt topilmadi.", buttons=ACCOUNTS_KB)
        except asyncio.TimeoutError:
            await bot.send_message(event.chat_id, "⏰ Vaqt tugadi.", buttons=ACCOUNTS_KB)


@bot.on(events.NewMessage(pattern="📋 Akkauntlar ro'yxati"))
async def btn_list_accounts(event):
    if not is_admin(event): return
    rows = db_all_accounts()
    if not rows:
        await event.reply("📋 Akkauntlar ro'yxati bo'sh.", buttons=ACCOUNTS_KB)
        return
    lines = [f"🔑 **Akkauntlar** ({len(rows)} ta):\n"]
    for i, (aid, telefon, tg_id, username, limit_tolgan) in enumerate(rows, 1):
        u      = f"@{username}" if username else "_yo'q_"
        online = "🟢" if tg_id in connected_clients else "🔴"
        limit  = " ⚠️ LIMIT TO'LDI" if limit_tolgan else " ✅ Bo'sh"
        lines.append(f"{i}. {online} {u} | `{telefon}`{limit}")
    await event.reply("\n".join(lines), buttons=ACCOUNTS_KB)


@bot.on(events.NewMessage(pattern="🔄 Limitni tiklash"))
async def btn_reset_limit(event):
    if not is_admin(event): return
    db_reset_limits()
    await event.reply("✅ Barcha akkauntlardagi limit tozalandi!", buttons=ACCOUNTS_KB)


# ─────────────────────────────────────────────
#  SOZLAMALAR
# ─────────────────────────────────────────────
@bot.on(events.NewMessage(pattern="⚙️ Sozlamalar"))
async def btn_settings(event):
    if not is_admin(event): return
    async with bot.conversation(event.chat_id, timeout=120) as conv:
        try:
            interval = db_get_interval()
            await conv.send_message(
                f"⚙️ **Sozlamalar**\n\n"
                f"Hozirgi tekshirish intervali: **{interval} soniya**\n\n"
                f"Yangi interval kiriting (soniyalarda, minimum 10):"
            )
            msg = await conv.get_response()
            try:
                new_interval = int(msg.text.strip())
                if new_interval < 10:
                    await conv.send_message("⚠️ Minimal 10 soniya bo'lishi kerak!", buttons=MAIN_KB)
                    return
                db_set_interval(new_interval)
                await conv.send_message(
                    f"✅ Tekshirish intervali **{new_interval} soniya** ga o'zgartirildi!",
                    buttons=MAIN_KB,
                )
            except ValueError:
                await conv.send_message("❌ Faqat raqam kiriting!", buttons=MAIN_KB)
        except asyncio.TimeoutError:
            await bot.send_message(event.chat_id, "⏰ Vaqt tugadi.", buttons=MAIN_KB)


# ─────────────────────────────────────────────
#  HOLAT
# ─────────────────────────────────────────────
@bot.on(events.NewMessage(pattern="📊 Holat"))
async def btn_status(event):
    if not is_admin(event): return
    users    = db_all_users()
    accounts = db_all_accounts()
    band     = db_all_band()
    interval = db_get_interval()
    limited  = sum(1 for a in accounts if a[4])
    await event.reply(
        f"📊 **Tizim holati**\n\n"
        f"👤 Kuzatilayotgan userlar: **{len(users)}**\n"
        f"🏁 Band qilingan usernamlar: **{len(band)}**\n"
        f"🔑 Jami akkauntlar: **{len(accounts)}**\n"
        f"🟢 Ulangan: **{len(connected_clients)}**\n"
        f"⚠️ Limit to'lgan: **{limited}**\n"
        f"⏱ Tekshirish intervali: **{interval} soniya**",
        buttons=MAIN_KB,
    )


# ─────────────────────────────────────────────
#  ORQAGA
# ─────────────────────────────────────────────
@bot.on(events.NewMessage(pattern="🔙 Orqaga"))
async def btn_back(event):
    if not is_admin(event): return
    await event.reply("🏠 Asosiy menyu:", buttons=MAIN_KB)


# ─────────────────────────────────────────────
#  RUXSATSIZ
# ─────────────────────────────────────────────
@bot.on(events.NewMessage)
async def catch_all(event):
    if not is_admin(event):
        await event.reply("⛔️ Bu shaxsiy bot! Sizga foydalanishga ruxsat berilmagan.")
        raise events.StopPropagation


# ─────────────────────────────────────────────
#  MAIN
# ─────────────────────────────────────────────
async def main():
    db_init()
    db_insert_users_bulk(INITIAL_USERS)
    log.info("Dastlabki %d user bazaga qo'shildi.", len(INITIAL_USERS))

    await bot.start(bot_token=BOT_TOKEN)
    log.info("Bot ishga tushdi. Admin: %d", ADMIN_ID)

    await load_accounts()

    try:
        interval = db_get_interval()
        await bot.send_message(
            ADMIN_ID,
            f"🟢 **Username Hunter Bot** ishga tushdi!\n\n"
            f"👤 Kuzatilayotgan userlar: **{len(INITIAL_USERS)}**\n"
            f"⏱ Tekshirish: har **{interval}** soniyada\n\n"
            f"Username bo'shagan zahoti avtomatik kanal ochiladi!",
            buttons=MAIN_KB,
        )
    except Exception as ex:
        log.exception("Start xabari yuborilmadi: %s", ex)

    await asyncio.gather(
        bot.run_until_disconnected(),
        check_engine(),
    )


if __name__ == "__main__":
    asyncio.run(main())
