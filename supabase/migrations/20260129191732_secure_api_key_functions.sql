-- Secure API key functions: restrict to service_role only
-- Prevents anonymous users from attempting to validate API keys (brute-force protection)

-- Revoke execute from public roles on validate_api_key
REVOKE EXECUTE ON FUNCTION validate_api_key(TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION validate_api_key(TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION validate_api_key(TEXT) FROM authenticated;

-- Only service_role can validate API keys (used by cli-api-key-auth edge function)
GRANT EXECUTE ON FUNCTION validate_api_key(TEXT) TO service_role;

-- create_cli_session_key already checks auth.uid() but restrict anyway for defense in depth
REVOKE EXECUTE ON FUNCTION create_cli_session_key() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION create_cli_session_key() FROM anon;

-- authenticated users need to call this during login
GRANT EXECUTE ON FUNCTION create_cli_session_key() TO authenticated;
GRANT EXECUTE ON FUNCTION create_cli_session_key() TO service_role;
