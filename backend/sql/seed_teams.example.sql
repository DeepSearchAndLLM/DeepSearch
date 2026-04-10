INSERT INTO teams (name)
VALUES
    ('Cyber Team'),
    ('Network Team'),
    ('Satellite Team')
ON CONFLICT (name) DO NOTHING;
