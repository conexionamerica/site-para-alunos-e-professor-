-- Add is_active column to profiles table if it doesn't exist
-- This column controls whether a student can log in or not

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'profiles' 
        AND column_name = 'is_active'
    ) THEN
        ALTER TABLE profiles 
        ADD COLUMN is_active BOOLEAN DEFAULT TRUE;
        
        -- Set all existing users to active by default
        UPDATE profiles SET is_active = TRUE WHERE is_active IS NULL;
    END IF;
END $$;

-- Add comment to the column
COMMENT ON COLUMN profiles.is_active IS 'Controls whether the user can log in. FALSE = inactive/blocked user';
