-- 1) Inspecter la table promotions actuelle
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'promotions'
ORDER BY ordinal_position;

-- 2) Si la table coupons existe deja avec les anciens noms, renommer les colonnes
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'coupons'
          AND column_name = 'date_exp'
    ) THEN
        ALTER TABLE coupons RENAME COLUMN date_exp TO expiration_date;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'coupons'
          AND column_name = 'statut'
    ) THEN
        ALTER TABLE coupons RENAME COLUMN statut TO status;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'coupons'
          AND column_name = 'coupons_utilises'
    ) THEN
        ALTER TABLE coupons RENAME COLUMN coupons_utilises TO used_count;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'coupons'
          AND column_name = 'coupons_autorises'
    ) THEN
        ALTER TABLE coupons RENAME COLUMN coupons_autorises TO allowed_count;
    END IF;
END $$;

-- 3) Creer la table coupons sans supprimer les anciennes colonnes de promotions
CREATE TABLE IF NOT EXISTS coupons (
    id BIGSERIAL PRIMARY KEY,
    code VARCHAR(255),
    expiration_date VARCHAR(255),
    status VARCHAR(50),
    used_count INTEGER NOT NULL DEFAULT 0,
    allowed_count INTEGER NOT NULL DEFAULT 0,
    promotion_id BIGINT NOT NULL,
    CONSTRAINT fk_coupons_promotion
        FOREIGN KEY (promotion_id)
        REFERENCES promotions(id)
        ON DELETE CASCADE,
    CONSTRAINT uk_coupons_promotion
        UNIQUE (promotion_id)
);

-- 4) Migrer les donnees existantes, une ligne coupon par promotion
INSERT INTO coupons (
    code,
    expiration_date,
    status,
    used_count,
    allowed_count,
    promotion_id
)
SELECT
    p.coupon_code,
    p.end_date,
    p.status,
    COALESCE(p.claimed_count, 0),
    COALESCE(p.usage_count, 0),
    p.id
FROM promotions p
WHERE NOT EXISTS (
    SELECT 1
    FROM coupons c
    WHERE c.promotion_id = p.id
);

-- 5) Verification rapide apres migration
SELECT
    c.id,
    c.code,
    c.expiration_date,
    c.status,
    c.used_count,
    c.allowed_count,
    c.promotion_id
FROM coupons c
ORDER BY c.id DESC;
