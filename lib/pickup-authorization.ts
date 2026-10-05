export type PickupAuthorizationStatus = 'requested' | 'confirmed' | 'cancelled' | 'expired' | 'collected';

export type PickupAuthorizationPublic = {
  id: string;
  status: PickupAuthorizationStatus;
  authorized_name: string;
  cpf_last4: string;
  delivery_channel: 'whatsapp' | 'email';
  contact_mask: string;
  verification_attempts: number;
  code_expires_at: string;
  confirmed_at: string | null;
  expires_at: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  collected_at: string | null;
};

export type PickupAuthorizationStaff = PickupAuthorizationPublic & {
  verification_code: string | null;
};

export type PickupAuthorizationStaffState = {
  feature_enabled: boolean;
  order_blocked: boolean;
  order_status: string;
  can_manage: boolean;
  is_manager: boolean;
  authorization: PickupAuthorizationStaff | null;
};

export function onlyDigits(value: string) {
  return value.replace(/\D/g, '');
}

export function isValidCpf(value: string) {
  const digits = onlyDigits(value);
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return false;
  const calculate = (length: number) => {
    let total = 0;
    for (let index = 0; index < length; index += 1) total += Number(digits[index]) * (length + 1 - index);
    const result = (total * 10) % 11;
    return result === 10 ? 0 : result;
  };
  return calculate(9) === Number(digits[9]) && calculate(10) === Number(digits[10]);
}

export function formatCpf(value: string) {
  return onlyDigits(value).slice(0, 11).replace(/^(\d{3})(\d)/, '$1.$2').replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1-$2');
}
