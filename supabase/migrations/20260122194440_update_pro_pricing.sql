-- Update Pro Monthly price from $29 to $9
UPDATE subscription_plans
SET price_cents = 900, updated_at = NOW()
WHERE id = 'pro_monthly';

-- Update Pro Annual price from $278.40 to $90
UPDATE subscription_plans
SET price_cents = 9000, updated_at = NOW()
WHERE id = 'pro_annual';
