# Guruhni tahrirlash — Frontend qo'llanma

**Base URL (prod):** `https://bunyodkor.api.cims.cognilabs.org`
**Auth:** har bir so'rovga `Authorization: Bearer <TOKEN>`. Tahrirlash uchun `groups:edit` ruxsati kerak (super admin bo'ladi).

**Javob: HA — guruhlarni tahrirlash mumkin.** Endpoint mavjud va ishlaydi (localda to'liq test qilindi).

---

## 1. Endpoint

```
PATCH /groups/{group_id}
Content-Type: application/json
Authorization: Bearer <TOKEN>
```

Bu **partial update** — faqat o'zgartirmoqchi bo'lgan maydonlarni yuboring.
Yuborilmagan maydonlar o'zgarmaydi.

---

## 2. Qaysi maydonlarni tahrirlash mumkin

| Maydon | Tur | Izoh |
|--------|-----|------|
| `name` | string | Guruh nomi |
| `description` | string \| null | Izoh |
| `schedule_days` | string \| null | Masalan `"Mon,Wed,Fri"` (matn, erkin format) |
| `schedule_time` | string \| null | Masalan `"18:00"` |
| `capacity` | int (1–50) | ⚠️ Endi faqat **ko'rsatish uchun** — ro'yxatga olishni cheklamaydi (pastga qarang) |
| `coach_id` | int \| null | Murabbiy (user id). Mavjud user bo'lishi kerak, aks holda 404 |

## 3. Qaysi maydonlarni tahrirlab BO'LMAYDI

| Maydon | Nima bo'ladi |
|--------|--------------|
| `identifier` | Boshqa qiymat yuborilsa → **400** (shartnoma raqamlarida ishlatilgani uchun o'zgartirib bo'lmaydi). Xuddi shu qiymatni yuborsangiz — muammosiz. |
| `birth_year` | Boshqa qiymat yuborilsa → **400** (shartnoma raqamlarida ishlatiladi). |
| `status` (ACTIVE/INACTIVE) | Bu endpoint **status'ni o'zgartirmaydi** — yuborilsa jimgina e'tiborga olinmaydi (xato bermaydi, lekin o'zgarmaydi). Guruhni "o'chirish" uchun `DELETE /groups/{id}` (soft-delete) ishlatiladi. |

---

## 4. So'rov / javob namunasi

**So'rov:**
```
PATCH /groups/42
{
  "name": "2017 C1 - Ertalabki",
  "description": "Dushanba/Chorshanba/Juma",
  "schedule_days": "Mon,Wed,Fri",
  "schedule_time": "09:00",
  "capacity": 30,
  "coach_id": 12
}
```

**200 — muvaffaqiyatli:**
```json
{
  "data": {
    "id": 42,
    "name": "2017 C1 - Ertalabki",
    "identifier": "C1",
    "birth_year": 2017,
    "description": "Dushanba/Chorshanba/Juma",
    "schedule_days": "Mon,Wed,Fri",
    "schedule_time": "09:00",
    "capacity": 30,
    "coach_id": 12,
    "created_at": "2025-01-10T08:00:00Z",
    "active_students_count": null,
    "waiting_list_count": null
  },
  "meta": null
}
```

> Eslatma: javobda `status` maydoni **qaytmaydi** (GroupRead unda yo'q).
> `active_students_count` / `waiting_list_count` odatda `null` — ular faqat
> guruhlar ro'yxati (`GET /groups`) so'ralganda to'ldiriladi.

---

## 5. Tayyor kod (JavaScript / fetch)

```js
const BASE_URL = "https://bunyodkor.api.cims.cognilabs.org";

async function updateGroup(groupId, fields, token) {
  const res = await fetch(`${BASE_URL}/groups/${groupId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify(fields),   // faqat o'zgargan maydonlar
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Guruhni saqlashda xatolik");
  }
  return (await res.json()).data;
}

// Ishlatish:
await updateGroup(42, { name: "Yangi nom", capacity: 30, coach_id: 12 }, token);
```

---

## 6. Xatolar

| Holat | Kod | Ma'nosi |
|-------|-----|---------|
| Guruh topilmadi | **404** | `{group_id}` mavjud emas |
| `identifier` yoki `birth_year`ni o'zgartirishga urinish | **400** | Bu maydonlar o'zgarmas |
| `coach_id` mavjud bo'lmagan user | **404** | To'g'ri user id bering |
| `capacity` 1 dan kichik yoki 50 dan katta | **422** | 1–50 oralig'ida bo'lsin |
| Token yo'q / ruxsat yo'q | **401 / 403** | Login / `groups:edit` kerak |

---

## 7. Muhim: `capacity` endi cheklamaydi

Ilgari guruh `capacity` "to'lganida" yangi o'quvchi qo'shib bo'lmasdi. **Endi bunday emas.**
- `capacity` maydoni saqlanadi va tahrirlanadi, lekin ro'yxatga olishni **bloklamaydi**
  (faqat ma'lumot sifatida ko'rsatiladi).
- Ro'yxatga olish endi **tug'ilgan yil bo'yicha umumiy limit** bilan boshqariladi
  (`/year-limits` — alohida hujjatga qarang: *YEAR_LIMIT_HOWTO_SET.md*).

---

## 8. Bog'liq endpointlar (kerak bo'lsa)

| Amal | Endpoint |
|------|----------|
| Bitta guruhni olish | `GET /groups/{group_id}` |
| Guruhlar ro'yxati (stats bilan) | `GET /groups` |
| Guruh yaratish | `POST /groups` (`name`, `identifier`, `birth_year`, ixtiyoriy `capacity`/`coach_id`) |
| Guruhni o'chirish (soft-delete) | `DELETE /groups/{group_id}` |

---

## 9. Test natijalari (local)

| # | Holat | Natija |
|---|-------|--------|
| 1 | name/description/schedule/capacity tahrir → saqlandi | ✅ 200 |
| 2 | coach_id (mavjud user) → o'rnatildi; mavjud emas → 404 | ✅ |
| 3 | identifier o'zgartirish → 400; birth_year → 400; bir xil identifier → 200 | ✅ |
| 4 | capacity 0 → 422; 51 → 422; 50 → 200 | ✅ |
| 5 | mavjud bo'lmagan guruh → 404 | ✅ |
| 6 | status yuborildi → 200, lekin status o'zgarmadi (e'tiborga olinmaydi) | ✅ |

Barcha testlar real ma'lumot nusxasida o'tkazildi, test guruh oxirida o'chirildi — real ma'lumotga ta'sir qilinmadi.
