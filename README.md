# Smart Restaurant Platform — Egyptian QR & Incoming Orders System

منصة المطاعم الذكية — نظام إدارة واستلام طلبات الطاولات اللحظي للسوق المصري.

---

## 1. Overview & Architecture

يتكون النظام من عميلين مستقلين ومتكاملين:

1. **عميل طلب العميل (Customer Ordering Client):** مسح كود الـ QR، تصفح المنيو، تخصيص الوجبات، وإرسال الطلب من الطاولة.
2. **شاشة استلام الطلبات وإدارتها (Incoming Orders Dashboard Client):** شاشة موظفي الصالة والمطبخ (POS) لاستلام الطلبات في الوقت الفعلي، تأكيدها، إرسالها للمطبخ، إشعار الجاهزية، وتقديمها للعميل.
3. **عميل الإدارة (Admin Client):** لإدارة المنيو والأسعار (خارج نطاق هذه المرحلة).

---

## 2. Available Routes

| المسار (Route) | نوع الواجهة | الوصف |
| :--- | :--- | :--- |
| `/` | عام | بوابة النظام ومحول الاختبار السريع للتنقل بين شاشة الموظفين وقوائم الطاولات. |
| `/orders` | **شاشة الموظفين (Dashboard)** | **شاشة استلام الطلبات الرئيسية اللحظية** مع فلاتر الحالات، فرز FIFO، تنبيهات صوتية، وبحث. |
| `/orders/[orderId]` | **شاشة الموظفين** | صفحة تفاصيل الطلب الكاملة المستقلة مع بون الطباعة وسجل الأحداث. |
| `/orders/history` | **شاشة الموظفين** | سجل الطلبات السابقة (المكتملة `SERVED` والملغاة `CANCELLED`) وإحصائيات المبيعات. |
| `/r/[restaurantSlug]/t/[tableToken]` | عميل المطعم | منيو العميل المباشر بعد مسح الـ QR. |
| `/r/[restaurantSlug]/t/[tableToken]/cart` | عميل المطعم | مراجعة سلة الطلبات وتأكيد الإرسال. |
| `/r/[restaurantSlug]/t/[tableToken]/order/[orderId]` | عميل المطعم | تتبع حالة تحضير الوجبة للعميل من الطاولة. |

---

## 3. Order Workflow Domain State Machine

دورة حياة الطلب مصممة بنموذج خطي محكم ومحمي برمجياً ضد القفزات غير القانونية:

```text
[ NEW ] ──────────> [ CONFIRMED ] ──────────> [ PREPARING ] ──────────> [ READY ] ──────────> [ SERVED ]
 (جديد)               (تم التأكيد)              (قيد التحضير)             (جاهز للتقديم)       (تم التقديم)
   │                       │                          │
   └───────> [ CANCELLED ] <──────────────────────────┘
               (ملغي مع توثيق السبب)
```

- **تأكيد الطلب (`CONFIRMED`):** متاح فقط من حالة `NEW`.
- **بدء التحضير (`PREPARING`):** متاح فقط من حالة `CONFIRMED`.
- **الطلب جاهز (`READY`):** متاح فقط من حالة `PREPARING`.
- **تم تقديم الطلب (`SERVED`):** متاح فقط من حالة `READY`، ويقوم بتحديث حالة الدفع تلقائياً إلى `PAID`.
- **إلغاء الطلب (`CANCELLED`):** متاح للطلبات غير المكتملة فقط، ويتطلب تأكيد المشرف مع تحديد سبب الإلغاء وتوثيقه في سجل التدقيق (`events`).

---

## 4. Real-time & Sound Features

- **نظام التنبيهات الصوتية (Web Audio API):** نغمة تنبيه ثنائية التردد مبهجة وعالية الجودة تعمل بدون ملفات خارجية أو أخطاء شبكة، مع زر كتم/تفعيل وتذكر إعدادات المشغل.
- **تكامل لحظي متقاطع (Cross-tab & Subscription):** عند إرسال أي طلب جديد من صفحة العميل، يظهر فوراً في شاشة `/orders` عبر `BroadcastChannel` و `orderRepository.subscribeToOrders()`.
- **زر محاكاة فوري (Simulate Incoming Order):** زر "محاكاة طلب جديد" لتوليد طلبات مصرية واقعية واختبار سير العمل بدون الحاجة لأجهزة إضافية.
- **تنبيه الطلبات المتأخرة:** تمييز الطلبات المتأخرة لأكثر من 15 دقيقة (أو أكثر من 7 دقائق للطلبات الجديدة) بشارة تحذيرية وفلتر مخصص.

---

## 5. Backend Integration Contract

عند ربط الشاشة مع السيرفر الحقيقي (Real Backend / Supabase / REST / WebSocket)، يعتمد Data Access Layer على عقد `IOrderRepository`:

### REST Endpoints Contract:
- `GET /api/v1/restaurants/{id}/orders/active`: إرجاع كل الطلبات بحالات `NEW`, `CONFIRMED`, `PREPARING`, `READY`.
- `GET /api/v1/restaurants/{id}/orders/history`: إرجاع الطلبات بحالات `SERVED`, `CANCELLED`.
- `GET /api/v1/orders/{orderId}`: إرجاع تفاصيل طلب محدد بلقطات الأسعار التاريخية.
- `PATCH /api/v1/orders/{orderId}/status`:
  ```json
  {
    "status": "CONFIRMED",
    "actor": "الكابتن أحمد (مشرف الصالة)",
    "note": "تم التأكيد"
  }
  ```
- `POST /api/v1/orders/{orderId}/cancel`:
  ```json
  {
    "reason": "طلب العميل الإلغاء",
    "actor": "الكابتن أحمد"
  }
  ```

### Real-time Event Payload (WebSocket / Supabase Realtime):
```json
{
  "type": "CREATED",
  "order": {
    "id": "ord_173000000",
    "orderNumber": "EG-1049",
    "restaurantId": "rest-01",
    "tableId": "table-04",
    "tableName": "طاولة 4",
    "status": "NEW",
    "items": [...],
    "subtotal": 450,
    "total": 450,
    "paymentStatus": "PENDING_CASHIER",
    "createdAt": "2026-10-27T10:15:00.000Z",
    "events": [...]
  }
}
```

---

## 6. Testing & Quality Verification

لتشغيل الاختبارات الآلية وضمان الجودة:

```bash
# تشغيل مجموعة الاختبارات الآلية لدورة حياة الطلبات
npm test

# فحص المعايير البرمجية وخلو الكود من الأخطاء
npm run lint

# بناء نسخة الإنتاج المحسنة
npm run build
```
