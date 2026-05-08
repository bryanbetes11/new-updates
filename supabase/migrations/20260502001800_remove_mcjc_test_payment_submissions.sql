-- ============================================================================
-- Remove MCJC billing test submissions
-- ----------------------------------------------------------------------------
-- Purpose:
--   * clean up manual-billing test data created on the exempt MCJC tenant
-- ============================================================================

delete from public.organization_payment_submissions
where org_id in (
  select id
  from public.organizations
  where slug = 'mcjc-church'
);
