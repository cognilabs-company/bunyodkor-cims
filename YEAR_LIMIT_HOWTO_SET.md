# Bir yil uchun limitni qo'shish — Frontend qo'llanma

> Maqsad: **berilgan tug'ilgan yil (masalan 2020) uchun umumiy o'quvchi limitini
> qo'shish/o'zgartirish**. Bu eng sodda, amaliy qo'llanma.

**Base URL (prod):** `https://bunyodkor.api.cims.cognilabs.org`
**Auth:** har bir so'rovga `Authorization: Bearer <TOKEN>` (login'dan olingan).
Yozish uchun foydalanuvchida `groups:edit` ruxsati bo'lishi kerak (super admin bo'ladi).

---

## 1. Eng muhim: 2 ta amal bor

| Amal | Method | Qachon ishlatiladi |
|------|--------|--------------------|
| **Yaratish** | `POST /year-limits` | Bu yil uchun limit hali **yo'q** bo'lsa |
| **O'zgartirish** | `PATCH /year-limits/{birth_year}` | Bu yil uchun limit **bor** bo'lsa |

> ⚠️ Ko'p uchraydigan xato: mavjud yilga yana `POST` yuborish → **409** qaytadi
> ("allaqachon mavjud"). Mavjud yilni o'zgartirish uchun **PATCH** ishlating.

Eng ishonchli yo'l: **avval GET qilib tekshiring**, keyin POST yoki PATCH.

---

## 2. Qadam-baqadam (tavsiya etilgan oqim)

### 1-qadam — yilda limit bor-yo'qligini tekshirish
```
GET /year-limits/{birth_year}
```
Misol: `GET /year-limits/2020`

Javob (limit **yo'q** — hali qo'yilmagan):
```json
{
  "data": {
    "birth_year": 2020,
    "max_students": null,
    "current_count": 42,
    "remaining": null,
    "is_full": false,
    "has_limit": false        // <-- FALSE = limit yo'q -> POST ishlating
  },
  "meta": null
}
```
Javob (limit **bor**):
```json
{
  "data": {
    "birth_year": 2020,
    "max_students": 200,
    "current_count": 187,
    "remaining": 13,
    "is_full": false,
    "has_limit": true         // <-- TRUE = limit bor -> PATCH ishlating
  },
  "meta": null
}
```

### 2-qadam — limit qo'yish

**Agar `has_limit === false` (yangi):**
```
POST /year-limits
Content-Type: application/json
Authorization: Bearer <TOKEN>

{ "birth_year": 2020, "max_students": 200 }
```

**Agar `has_limit === true` (o'zgartirish):**
```
PATCH /year-limits/2020
Content-Type: application/json
Authorization: Bearer <TOKEN>

{ "max_students": 250 }
```

Ikkalasi ham muvaffaqiyatda **200** qaytaradi:
```json
{
  "data": {
    "id": 3,
    "birth_year": 2020,
    "max_students": 200,
    "created_at": "2026-09-12T11:00:00Z",
    "updated_at": "2026-09-12T11:00:00Z"
  },
  "meta": null
}
```

---

## 3. Tayyor kod (JavaScript / fetch)

Bitta funksiya — yilga limitni **qo'yadi yoki o'zgartiradi** (upsert):

```js
const BASE_URL = "https://bunyodkor.api.cims.cognilabs.org";

async function setYearLimit(birthYear, maxStudents, token) {
  const headers = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token}`,
  };

  // 1) Bu yilda limit bor-yo'qligini tekshiramiz
  const check = await fetch(`${BASE_URL}/year-limits/${birthYear}`, { headers });
  const { data } = await check.json();

  let res;
  if (data.has_limit) {
    // 2a) Bor -> o'zgartiramiz
    res = await fetch(`${BASE_URL}/year-limits/${birthYear}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ max_students: maxStudents }),
    });
  } else {
    // 2b) Yo'q -> yaratamiz
    res = await fetch(`${BASE_URL}/year-limits`, {
      method: "POST",
      headers,
      body: JSON.stringify({ birth_year: birthYear, max_students: maxStudents }),
    });
  }

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Limitni saqlashda xatolik");
  }
  return (await res.json()).data;   // { id, birth_year, max_students, ... }
}

// Ishlatish:
await setYearLimit(2020, 200, token);   // 2020-yilga 200 limit
await setYearLimit(2020, 250, token);   // keyin o'zgartirish (avtomatik PATCH)
```

---

## 4. Limitni o'chirish (yil yana cheksiz bo'ladi)

```
DELETE /year-limits/2020
```
- **200:** o'chirildi, endi 2020 cheksiz.
- **404:** bu yil uchun limit yo'q edi.

---

## 5. Barcha limitlarni ro'yxatda ko'rsatish (admin jadvali uchun)

Har bir limit + joriy foydalanishni bitta so'rovda olish:
```
GET /year-limits/usage
```
Javob:
```json
{
  "data": [
    { "birth_year": 2020, "max_students": 200, "current_count": 187,
      "remaining": 13, "is_full": false, "has_limit": true },
    { "birth_year": 2019, "max_students": 150, "current_count": 150,
      "remaining": 0,  "is_full": true,  "has_limit": true }
  ],
  "meta": null
}
```
> Faqat "raw" limitlar kerak bo'lsa (foydalanishsiz): `GET /year-limits`.

---

## 6. Xatolar (nima qaytadi)

| Holat | Kod | Ma'nosi / nima qilish |
|-------|-----|----------------------|
| Mavjud yilga POST | **409** | Limit allaqachon bor → PATCH ishlating |
| Mavjud bo'lmagan yilga PATCH/DELETE | **404** | Avval POST bilan yarating |
| `max_students` manfiy, yoki `birth_year` 1900–2100 dan tashqarida | **422** | Qiymatni to'g'rilang (`max_students` 0 yoki musbat butun son) |
| Token yo'q / ruxsat yo'q | **401 / 403** | Login qiling / `groups:edit` ruxsati kerak |

`max_students` qoidalari:
- Butun son, **0 yoki undan katta**.
- `0` = o'sha yil **yopiq** (yangi o'quvchi qo'shib bo'lmaydi).
- Manfiy son yuborilsa → 422.

---

## 7. Bu limit qanday ishlaydi (qisqacha)

- Limit **tug'ilgan yil** bo'yicha (guruh bo'yicha emas).
- Hisob: o'sha yildagi **barcha guruhlardagi faol shartnomalar (o'quvchilar) yig'indisi**.
- O'quvchi qo'shishda (`POST /students/create-with-contract`) shu yil to'lgan bo'lsa,
  backend **409** qaytaradi va o'quvchi qo'shilmaydi.
- Limit qo'yilmagan yil = cheksiz.

**Xulosa:** bir yilga limit qo'yish = `GET /year-limits/{year}` bilan tekshir →
`has_limit` bo'yicha **POST** (yangi) yoki **PATCH** (o'zgartirish). Tamom.
