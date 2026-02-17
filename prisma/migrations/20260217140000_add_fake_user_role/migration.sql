-- Alter the role enum to include FAKE_USER for synthetic/테스트용 계정 구분.
ALTER TYPE "role" ADD VALUE 'FAKE_USER';
