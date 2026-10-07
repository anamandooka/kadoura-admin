-- جدول الطلبات موجود بالفعل في مشروعك.
-- هذا الملف مرجعي فقط ولا تحتاج لتشغيله إذا كان جدول orders موجودًا.

select to_regclass('public.orders');

select policyname, cmd, roles
from pg_policies
where schemaname = 'public' and tablename = 'orders';
