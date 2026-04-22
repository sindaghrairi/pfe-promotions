CREATE TABLE IF NOT EXISTS invoices (
  id BIGSERIAL PRIMARY KEY,
  company_name VARCHAR(255) NOT NULL,
  company_email VARCHAR(255) NOT NULL,
  plan VARCHAR(255) NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  status VARCHAR(32) NOT NULL CHECK (status IN ('PENDING', 'PAID', 'OVERDUE', 'CANCELED')),
  issued_at DATE NOT NULL,
  due_at DATE NOT NULL,
  paid_at DATE,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

INSERT INTO invoices (company_name, company_email, plan, amount, status, issued_at, due_at, paid_at, created_at)
SELECT
  src.company_name,
  src.company_email,
  src.plan,
  src.amount,
  src.status,
  src.issued_at,
  src.due_at,
  src.paid_at,
  now()
FROM (
  VALUES
    ('Decathlon', 'contact@decathlon.tn', 'PREMIUM', 299.00::numeric(12,2), 'PAID', CURRENT_DATE - INTERVAL '20 days', CURRENT_DATE - INTERVAL '5 days', CURRENT_DATE - INTERVAL '7 days'),
    ('Monoprix', 'contact@monoprix.tn', 'STANDARD', 149.00::numeric(12,2), 'PENDING', CURRENT_DATE - INTERVAL '3 days', CURRENT_DATE + INTERVAL '27 days', NULL::date),
    ('Fatales', 'contact@fatales.tn', 'BASIC', 79.00::numeric(12,2), 'OVERDUE', CURRENT_DATE - INTERVAL '40 days', CURRENT_DATE - INTERVAL '10 days', NULL::date)
) AS src(company_name, company_email, plan, amount, status, issued_at, due_at, paid_at)
WHERE NOT EXISTS (
  SELECT 1
  FROM invoices i
  WHERE i.company_email = src.company_email
    AND i.plan = src.plan
    AND i.issued_at = src.issued_at::date
);
