"""
Username Hunter Bot - Mukammal versiya
- Ko'p akkaunt ulash (Telegram kod + 2FA)
- Username bo'shagan zahoti kanal ochish
- Band qilinganlar alohida ro'yxat
- Qayta-qayta tekshirilish muammosi yo'q
"""

import asyncio
import sqlite3
import logging
import os
from telethon import TelegramClient, events, Button
from telethon.tl.types import User, Channel
from telethon.tl.functions.channels import CreateChannelRequest, UpdateUsernameRequest
from telethon.errors import (
    UsernameNotOccupiedError,
    UsernameInvalidError,
    FloodWaitError,
    UserDeactivatedError,
    UserDeactivatedBanError,
    SessionPasswordNeededError,
    PhoneCodeInvalidError,
    PhoneCodeExpiredError,
    ChannelsAdminPublicTooMuchError,
    ChatAdminRequiredError,
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
#  BOT MIJOZI
# ─────────────────────────────────────────────
bot = TelegramClient("hunter_bot_session", API_ID, API_HASH)

# Runtime: {tg_id: TelegramClient}
connected_clients: dict = {}

# ─────────────────────────────────────────────
#  DATABASE
# ─────────────────────────────────────────────
def db_init():
    with sqlite3.connect(DB_FILE) as con:
        con.execute("""
            CREATE TABLE IF NOT EXISTS userlar (
                tg_id    INTEGER PRIMARY KEY,
                username TEXT NOT NULL COLLATE NOCASE,
                ism      TEXT DEFAULT '',
                status   TEXT DEFAULT 'Faol'
            )
        """)
        con.execute("""
            CREATE TABLE IF NOT EXISTS band_userlar (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                username   TEXT NOT NULL,
                kanal_link TEXT DEFAULT '',
                akkaunt    TEXT DEFAULT '',
                vaqt       DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)
        con.execute("""
            CREATE TABLE IF NOT EXISTS akkauntlar (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                telefon      TEXT UNIQUE NOT NULL,
                tg_id        INTEGER UNIQUE,
                username     TEXT DEFAULT '',
                limit_tolgan INTEGER DEFAULT 0
            )
        """)
        con.execute("""
            CREATE TABLE IF NOT EXISTS sozlamalar (
                kalit  TEXT PRIMARY KEY,
                qiymat TEXT NOT NULL
            )
        """)
        con.execute("INSERT OR IGNORE INTO sozlamalar VALUES ('interval','60')")
        con.commit()
    log.info("DB tayyor: %s", DB_FILE)


def db_bulk_insert(users: list):
    with sqlite3.connect(DB_FILE) as con:
        con.executemany(
            "INSERT OR IGNORE INTO userlar (tg_id,username,ism,status) VALUES (?,?,?,?)",
            users
        )
        con.commit()


# ── Sozlamalar ──
def db_get_interval() -> int:
    with sqlite3.connect(DB_FILE) as con:
        r = con.execute("SELECT qiymat FROM sozlamalar WHERE kalit='interval'").fetchone()
        return int(r[0]) if r else 60

def db_set_interval(sec: int):
    with sqlite3.connect(DB_FILE) as con:
        con.execute("INSERT OR REPLACE INTO sozlamalar VALUES ('interval',?)", (str(sec),))
        con.commit()


# ── Userlar ──
def db_add_user(tg_id: int, username: str, ism: str):
    with sqlite3.connect(DB_FILE) as con:
        con.execute(
            "INSERT OR REPLACE INTO userlar (tg_id,username,ism,status) VALUES (?,?,?,'Faol')",
            (tg_id, username.lower().lstrip("@"), ism)
        )
        con.commit()

def db_delete_user(identifier: str) -> bool:
    with sqlite3.connect(DB_FILE) as con:
        try:
            tid = int(identifier)
            if con.execute("SELECT 1 FROM userlar WHERE tg_id=?", (tid,)).fetchone():
                con.execute("DELETE FROM userlar WHERE tg_id=?", (tid,))
                con.commit()
                return True
        except ValueError:
            pass
        clean = identifier.lstrip("@").lower()
        if con.execute("SELECT 1 FROM userlar WHERE LOWER(username)=?", (clean,)).fetchone():
            con.execute("DELETE FROM userlar WHERE LOWER(username)=?", (clean,))
            con.commit()
            return True
    return False

def db_all_users() -> list:
    with sqlite3.connect(DB_FILE) as con:
        return con.execute(
            "SELECT tg_id, username, ism, status FROM userlar"
        ).fetchall()

def db_update_username(tg_id: int, new_username: str):
    with sqlite3.connect(DB_FILE) as con:
        con.execute("UPDATE userlar SET username=? WHERE tg_id=?", (new_username.lower(), tg_id))
        con.commit()

def db_update_status(tg_id: int, status: str):
    with sqlite3.connect(DB_FILE) as con:
        con.execute("UPDATE userlar SET status=? WHERE tg_id=?", (status, tg_id))
        con.commit()

def db_username_exists_in_users(username: str) -> bool:
    with sqlite3.connect(DB_FILE) as con:
        r = con.execute(
            "SELECT 1 FROM userlar WHERE LOWER(username)=?", (username.lower(),)
        ).fetchone()
        return r is not None

def db_username_exists_in_band(username: str) -> bool:
    with sqlite3.connect(DB_FILE) as con:
        r = con.execute(
            "SELECT 1 FROM band_userlar WHERE LOWER(username)=?", (username.lower(),)
        ).fetchone()
        return r is not None


# ── Band qilinganlar ──
def db_move_to_band(username: str, kanal_link: str, akkaunt: str):
    """Userni kuzatuvdan olib, band ro'yxatiga qo'shadi."""
    with sqlite3.connect(DB_FILE) as con:
        con.execute("DELETE FROM userlar WHERE LOWER(username)=?", (username.lower(),))
        # Takroriy qo'shmaslik
        if not con.execute(
            "SELECT 1 FROM band_userlar WHERE LOWER(username)=?", (username.lower(),)
        ).fetchone():
            con.execute(
                "INSERT INTO band_userlar (username,kanal_link,akkaunt) VALUES (?,?,?)",
                (username.lower(), kanal_link, akkaunt)
            )
        con.commit()

def db_all_band() -> list:
    with sqlite3.connect(DB_FILE) as con:
        return con.execute(
            "SELECT id,username,kanal_link,akkaunt,vaqt FROM band_userlar ORDER BY vaqt DESC"
        ).fetchall()


# ── Akkauntlar ──
def db_add_account(telefon: str, tg_id: int, username: str):
    with sqlite3.connect(DB_FILE) as con:
        con.execute(
            "INSERT OR REPLACE INTO akkauntlar (telefon,tg_id,username,limit_tolgan) VALUES (?,?,?,0)",
            (telefon, tg_id, username)
        )
        con.commit()

def db_all_accounts() -> list:
    with sqlite3.connect(DB_FILE) as con:
        return con.execute(
            "SELECT id,telefon,tg_id,username,limit_tolgan FROM akkauntlar"
        ).fetchall()

def db_delete_account(telefon: str) -> bool:
    with sqlite3.connect(DB_FILE) as con:
        r = con.execute("SELECT tg_id FROM akkauntlar WHERE telefon=?", (telefon,)).fetchone()
        if r:
            # Session faylini o'chirish
            for ext in [".session", ".session-journal"]:
                fp = os.path.join(SESSIONS_DIR, telefon.replace("+", "") + ext)
                if os.path.exists(fp):
                    os.remove(fp)
            # Runtime dan o'chirish
            if r[0] in connected_clients:
                try:
                    asyncio.create_task(connected_clients[r[0]].disconnect())
                except Exception:
                    pass
                del connected_clients[r[0]]
            con.execute("DELETE FROM akkauntlar WHERE telefon=?", (telefon,))
            con.commit()
            return True
    return False

def db_set_limit(telefon: str, val: int):
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
    [Button.text("👤 Userlar"),          Button.text("🔑 Akkauntlar")],
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


def is_admin(event) -> bool:
    return event.sender_id == ADMIN_ID


# ─────────────────────────────────────────────
#  AKKAUNTLARNI YUKLASH (startup)
# ─────────────────────────────────────────────
async def load_accounts():
    rows = db_all_accounts()
    loaded = 0
    for _, telefon, tg_id, username, _ in rows:
        sp = os.path.join(SESSIONS_DIR, telefon.replace("+", ""))
        if not os.path.exists(sp + ".session"):
            log.warning("Session fayl yo'q: %s", telefon)
            continue
        try:
            client = TelegramClient(sp, API_ID, API_HASH)
            await client.connect()
            if await client.is_user_authorized():
                connected_clients[tg_id] = client
                loaded += 1
                log.info("Akkaunt ulandi: %s @%s", telefon, username)
            else:
                await client.disconnect()
                log.warning("Avtorizatsiya yo'q: %s", telefon)
        except Exception as ex:
            log.exception("Yuklash xatosi [%s]: %s", telefon, ex)
    log.info("Jami %d akkaunt yuklandi.", loaded)


# ─────────────────────────────────────────────
#  KANAL OCHISH
# ─────────────────────────────────────────────
async def open_channel(username: str) -> bool:
    """
    Bo'sh username uchun ulangan akkauntlardan biriga kanal ochadi.
    Muvaffaqiyatli bo'lsa True, aks holda False.
    """
    accounts = db_all_accounts()
    if not accounts:
        await bot.send_message(
            ADMIN_ID,
            "⚠️ Hech qanday akkaunt ulanmagan!\n"
            "Avval '➕ Akkaunt ulash' tugmasini bosing.",
            buttons=MAIN_KB,
        )
        return False

    for _, telefon, tg_id, acc_uname, limit_tolgan in accounts:
        if limit_tolgan:
            continue

        client = connected_clients.get(tg_id)
        if not client:
            log.warning("Client topilmadi (ulangan emas): %s", telefon)
            continue

        try:
            # 1. Kanal yaratish
            result = await client(CreateChannelRequest(
                title=username,
                about=f"@{username}",
                megagroup=False,
            ))
            channel = result.chats[0]
            await asyncio.sleep(3)

            # 2. Username o'rnatish
            await client(UpdateUsernameRequest(channel, username))

            kanal_link = f"t.me/{username}"
            log.info("Kanal ochildi: @%s | akkaunt: %s", username, telefon)

            # 3. Kuzatuvdan olib, band ro'yxatiga qo'shish
            db_move_to_band(username, kanal_link, telefon)

            await bot.send_message(
                ADMIN_ID,
                f"✅ **@{username}** BAND QILINDI!\n\n"
                f"🔗 Kanal: t.me/{username}\n"
                f"🔑 Akkaunt: `{telefon}`",
                buttons=MAIN_KB,
            )
            return True

        except ChannelsAdminPublicTooMuchError:
            log.warning("Kanal limit to'ldi: %s", telefon)
            db_set_limit(telefon, 1)
            await bot.send_message(
                ADMIN_ID,
                f"⚠️ `{telefon}` akkauntida public kanal limiti to'ldi!\n"
                f"Keyingi akkauntdan urinilmoqda...",
            )
            continue

        except FloodWaitError as e:
            log.warning("FloodWait (kanal ochish): %ds", e.seconds)
            await asyncio.sleep(e.seconds + 3)
            continue

        except Exception as ex:
            log.exception("Kanal ochish xatosi [%s]: %s", telefon, ex)
            continue

    # Hamma akkauntlarda limit to'lgan
    await bot.send_message(
        ADMIN_ID,
        f"❌ **@{username}** bo'shadi, lekin\n"
        f"barcha akkauntlarda limit to'lgan!\n\n"
        f"'🔄 Limitni tiklash' tugmasini bosing yoki yangi akkaunt qo'shing.",
        buttons=MAIN_KB,
    )
    return False


# ─────────────────────────────────────────────
#  TEKSHIRUV ENGINE (background)
# ─────────────────────────────────────────────
# Hozir band qilinayotgan usernamelar seti (takroriy urinishni oldini olish)
processing: set = set()

async def check_engine():
    await asyncio.sleep(15)
    log.info("Check engine ishga tushdi.")

    while True:
        interval = db_get_interval()
        try:
            rows = db_all_users()
            for tg_id, username, ism, status in rows:
                if not username:
                    continue

                # Hozir band qilinayotgan bo'lsa — o'tkazib yuboramiz
                if username.lower() in processing:
                    continue

                await asyncio.sleep(1.5)

                try:
                    entity = await bot.get_entity(username)

                    if not isinstance(entity, User):
                        continue

                    # Akkaunt o'chirilganmi?
                    if entity.deleted:
                        processing.add(username.lower())
                        log.info("Akkaunt o'chirildi: @%s", username)
                        await bot.send_message(
                            ADMIN_ID,
                            f"🗑 **@{username}** akkauntini o'chirdi!\n"
                            f"⚡️ Username band qilinmoqda...",
                        )
                        await open_channel(username)
                        processing.discard(username.lower())
                        continue

                    # Username o'zgardimi?
                    current_uname = (entity.username or "").lower()
                    saved_uname   = username.lower()

                    if current_uname and current_uname != saved_uname:
                        processing.add(saved_uname)
                        log.info("Username o'zgardi: @%s -> @%s", username, entity.username)
                        db_update_username(tg_id, entity.username)
                        await bot.send_message(
                            ADMIN_ID,
                            f"🔄 **{ism or username}** username'ni o'zgartirdi!\n"
                            f"🔹 Eski: @{username}\n"
                            f"🔸 Yangi: @{entity.username}\n\n"
                            f"⚡️ Eski username band qilinmoqda...",
                        )
                        await open_channel(saved_uname)
                        processing.discard(saved_uname)

                except (UsernameNotOccupiedError, UsernameInvalidError, ValueError):
                    # USERNAME BO'SHADI!
                    if username.lower() not in processing:
                        processing.add(username.lower())
                        log.info("USERNAME BO'SHADI: @%s", username)
                        await bot.send_message(
                            ADMIN_ID,
                            f"🎯 **@{username}** BO'SHADI!\n"
                            f"⚡️ Kanal ochilmoqda...",
                        )
                        await open_channel(username)
                        processing.discard(username.lower())

                except (UserDeactivatedError, UserDeactivatedBanError):
                    if username.lower() not in processing:
                        processing.add(username.lower())
                        log.info("Akkaunt deaktiv: @%s", username)
                        await bot.send_message(
                            ADMIN_ID,
                            f"🗑 **@{username}** akkauntini o'chirdi!\n"
                            f"⚡️ Username band qilinmoqda...",
                        )
                        await open_channel(username)
                        processing.discard(username.lower())

                except FloodWaitError as e:
                    log.warning("FloodWait (tekshiruv): %ds", e.seconds)
                    await asyncio.sleep(e.seconds + 5)

                except Exception as ex:
                    log.exception("Tekshiruv xatosi [@%s]: %s", username, ex)

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
    u = db_all_users()
    a = db_all_accounts()
    b = db_all_band()
    i = db_get_interval()
    await event.reply(
        f"👋 **Username Hunter Bot**\n\n"
        f"👤 Kuzatilayotgan: **{len(u)}** ta\n"
        f"🏁 Band qilingan: **{len(b)}** ta\n"
        f"🔑 Akkauntlar: **{len(a)}** ta\n"
        f"🟢 Ulangan: **{len(connected_clients)}** ta\n"
        f"⏱ Interval: **{i}** soniya\n\n"
        f"Username bo'shagan zahoti avtomatik kanal ochiladi!",
        buttons=MAIN_KB,
    )
    raise events.StopPropagation


# ─────────────────────────────────────────────
#  USERLAR
# ─────────────────────────────────────────────
@bot.on(events.NewMessage(pattern="👤 Userlar"))
async def btn_users(event):
    if not is_admin(event): return
    await event.reply(
        f"👤 **Userlar bo'limi**\nKuzatuvda: {len(db_all_users())} ta",
        buttons=USERS_KB,
    )


@bot.on(events.NewMessage(pattern="➕ User qo'shish"))
async def btn_add_user(event):
    if not is_admin(event): return
    async with bot.conversation(event.chat_id, timeout=120) as conv:
        try:
            await conv.send_message("🔗 Username kiriting (masalan: @username):")
            msg      = await conv.get_response()
            username = msg.text.strip().lstrip("@").lower()

            if not username:
                await conv.send_message("⚠️ Username bo'sh bo'lishi mumkin emas.", buttons=USERS_KB)
                return

            # Band qilinganlar orasida bormi?
            if db_username_exists_in_band(username):
                await conv.send_message(
                    f"⚠️ @{username} allaqachon band qilingan ro'yxatda!",
                    buttons=USERS_KB,
                )
                return

            # Kuzatuvda bormi?
            if db_username_exists_in_users(username):
                await conv.send_message(
                    f"⚠️ @{username} allaqachon kuzatuvda!", buttons=USERS_KB
                )
                return

            try:
                entity = await bot.get_entity(username)
                if isinstance(entity, User):
                    db_add_user(entity.id, entity.username or username, entity.first_name or "")
                    await conv.send_message(
                        f"✅ **@{entity.username or username}** kuzatuvga qo'shildi!",
                        buttons=USERS_KB,
                    )
                else:
                    await conv.send_message(
                        "⚠️ Bu guruh/kanal. Foydalanuvchi username kiriting.",
                        buttons=USERS_KB,
                    )
            except (UsernameNotOccupiedError, UsernameInvalidError, ValueError):
                await conv.send_message(
                    f"❌ @{username} topilmadi. Username mavjud emas.",
                    buttons=USERS_KB,
                )
            except FloodWaitError as e:
                await conv.send_message(f"⏳ {e.seconds}s kuting.", buttons=USERS_KB)
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
                await conv.send_message("✅ User kuzatuvdan o'chirildi!", buttons=USERS_KB)
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
    lines = [f"📋 **Kuzatilayotgan userlar** ({len(rows)} ta):\n"]
    for i, (tid, uname, ism, status) in enumerate(rows, 1):
        s = "🟢" if status == "Faol" else "🔴"
        lines.append(f"{i}. {s} @{uname}")
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
    lines = [f"🏁 **Band qilinganlar** ({len(rows)} ta):\n"]
    for i, (bid, uname, link, akk, vaqt) in enumerate(rows, 1):
        lines.append(
            f"{i}. @{uname}\n"
            f"   🔗 {link or 'kutilmoqda'}\n"
            f"   🔑 {akk or '—'}\n"
            f"   🕐 {str(vaqt)[:16]}"
        )
    text = "\n\n".join(lines)
    for i in range(0, len(text), 4000):
        await event.reply(text[i:i+4000], buttons=MAIN_KB)


# ─────────────────────────────────────────────
#  AKKAUNTLAR
# ─────────────────────────────────────────────
@bot.on(events.NewMessage(pattern="🔑 Akkauntlar"))
async def btn_accounts(event):
    if not is_admin(event): return
    a = db_all_accounts()
    await event.reply(
        f"🔑 **Akkauntlar bo'limi**\n"
        f"Jami: {len(a)} ta | Ulangan: {len(connected_clients)} ta",
        buttons=ACCOUNTS_KB,
    )


@bot.on(events.NewMessage(pattern="➕ Akkaunt ulash"))
async def btn_add_account(event):
    if not is_admin(event): return
    async with bot.conversation(event.chat_id, timeout=300) as conv:
        try:
            await conv.send_message(
                "📱 Telefon raqam kiriting:\n"
                "_(Masalan: +998901234567)_"
            )
            p_msg   = await conv.get_response()
            telefon = p_msg.text.strip()

            if not telefon.startswith("+"):
                await conv.send_message(
                    "⚠️ Raqam + belgisi bilan boshlanishi kerak.\n"
                    "Masalan: +998901234567",
                    buttons=ACCOUNTS_KB,
                )
                return

            sp     = os.path.join(SESSIONS_DIR, telefon.replace("+", ""))
            client = TelegramClient(sp, API_ID, API_HASH)
            await client.connect()

            sent = await client.send_code_request(telefon)
            await conv.send_message(
                "📨 **Kod yuborildi!**\n\n"
                "Telegramga yoki SMS ga kelgan kodni kiriting:\n"
                "_(Masalan: 12345 yoki 1 2 3 4 5)_"
            )

            c_msg = await conv.get_response()
            code  = c_msg.text.strip().replace(" ", "")

            try:
                await client.sign_in(telefon, code)

            except SessionPasswordNeededError:
                await conv.send_message(
                    "🔐 Bu akkauntda **2FA** (ikki bosqichli) himoya bor.\n"
                    "Parolni kiriting:"
                )
                pass_msg = await conv.get_response()
                try:
                    await client.sign_in(password=pass_msg.text.strip())
                except Exception as ex:
                    await conv.send_message(
                        f"❌ Parol noto'g'ri: {str(ex)[:100]}",
                        buttons=ACCOUNTS_KB,
                    )
                    await client.disconnect()
                    return

            except PhoneCodeInvalidError:
                await conv.send_message(
                    "❌ Kod noto'g'ri! Qaytadan '➕ Akkaunt ulash' tugmasini bosing.",
                    buttons=ACCOUNTS_KB,
                )
                await client.disconnect()
                return

            except PhoneCodeExpiredError:
                await conv.send_message(
                    "❌ Kod muddati o'tdi! Qaytadan urinib ko'ring.",
                    buttons=ACCOUNTS_KB,
                )
                await client.disconnect()
                return

            # Muvaffaqiyatli ulandi
            me = await client.get_me()
            db_add_account(telefon, me.id, me.username or "")
            connected_clients[me.id] = client

            log.info("Akkaunt ulandi: %s @%s (id: %d)", telefon, me.username, me.id)
            await conv.send_message(
                f"✅ **Akkaunt muvaffaqiyatli ulandi!**\n\n"
                f"👤 Ism: {me.first_name}\n"
                f"🔗 @{me.username or '—'}\n"
                f"📱 `{telefon}`",
                buttons=ACCOUNTS_KB,
            )

        except asyncio.TimeoutError:
            await bot.send_message(
                event.chat_id,
                "⏰ Vaqt tugadi (5 daqiqa). Qaytadan urinib ko'ring.",
                buttons=ACCOUNTS_KB,
            )
        except Exception as ex:
            log.exception("Akkaunt ulash xatosi: %s", ex)
            await bot.send_message(
                event.chat_id,
                f"⚠️ Kutilmagan xato: {str(ex)[:200]}",
                buttons=ACCOUNTS_KB,
            )


@bot.on(events.NewMessage(pattern="❌ Akkauntni o'chirish"))
async def btn_del_account(event):
    if not is_admin(event): return
    async with bot.conversation(event.chat_id, timeout=120) as conv:
        try:
            rows = db_all_accounts()
            if not rows:
                await conv.send_message("📋 Akkauntlar ro'yxati bo'sh.", buttons=ACCOUNTS_KB)
                return
            lines = ["📱 Qaysi akkauntni o'chirmoqchisiz?\nTelefon raqamini kiriting:\n"]
            for i, (_, tel, _, uname, _) in enumerate(rows, 1):
                lines.append(f"{i}. `{tel}` @{uname or '—'}")
            await conv.send_message("\n".join(lines))
            msg     = await conv.get_response()
            telefon = msg.text.strip()
            if db_delete_account(telefon):
                await conv.send_message(f"✅ `{telefon}` o'chirildi!", buttons=ACCOUNTS_KB)
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
    for i, (_, tel, tid, uname, lim) in enumerate(rows, 1):
        online = "🟢" if tid in connected_clients else "🔴"
        limit  = " ⚠️limit" if lim else " ✅"
        u      = f"@{uname}" if uname else "—"
        lines.append(f"{i}. {online} {u} | `{tel}`{limit}")
    await event.reply("\n".join(lines), buttons=ACCOUNTS_KB)


@bot.on(events.NewMessage(pattern="🔄 Limitni tiklash"))
async def btn_reset(event):
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
            cur = db_get_interval()
            await conv.send_message(
                f"⚙️ **Sozlamalar**\n\n"
                f"Hozirgi tekshirish intervali: **{cur} soniya**\n\n"
                f"Yangi interval kiriting (minimum 10 soniya):"
            )
            msg = await conv.get_response()
            try:
                new_val = int(msg.text.strip())
                if new_val < 10:
                    await conv.send_message("⚠️ Minimal 10 soniya!", buttons=MAIN_KB)
                    return
                db_set_interval(new_val)
                await conv.send_message(
                    f"✅ Interval **{new_val} soniya** ga o'zgartirildi!",
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
    u   = db_all_users()
    a   = db_all_accounts()
    b   = db_all_band()
    lim = sum(1 for x in a if x[4])
    await event.reply(
        f"📊 **Tizim holati**\n\n"
        f"👤 Kuzatilayotgan: **{len(u)}** ta\n"
        f"🏁 Band qilingan: **{len(b)}** ta\n"
        f"🔑 Akkauntlar: **{len(a)}** ta\n"
        f"🟢 Ulangan: **{len(connected_clients)}** ta\n"
        f"⚠️ Limit to'lgan: **{lim}** ta\n"
        f"⏱ Interval: **{db_get_interval()}** soniya",
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
    db_bulk_insert(INITIAL_USERS)
    log.info("Dastlabki %d user bazaga qo'shildi.", len(INITIAL_USERS))

    await bot.start(bot_token=BOT_TOKEN)
    log.info("Bot ishga tushdi. Admin: %d", ADMIN_ID)

    await load_accounts()

    try:
        await bot.send_message(
            ADMIN_ID,
            f"🟢 **Username Hunter Bot** ishga tushdi!\n\n"
            f"👤 Kuzatilayotgan: **{len(INITIAL_USERS)}** ta user\n"
            f"🔑 Ulangan akkauntlar: **{len(connected_clients)}** ta\n"
            f"⏱ Tekshirish intervali: **{db_get_interval()}** soniya\n\n"
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
