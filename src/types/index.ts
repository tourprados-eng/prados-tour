export type AppRole =
  | "SUPER_ADMIN"
  | "ADMIN"
  | "FINANCEIRO"
  | "VENDEDOR"
  | "MONITOR"
  | "CLIENTE";

export type TripStatus =
  | "RASCUNHO"
  | "PUBLICADA"
  | "ESGOTADA"
  | "CANCELADA"
  | "FINALIZADA";

export type BookingStatus = "PENDENTE" | "CONFIRMADA" | "CANCELADA" | "CONCLUIDA";
export type PaymentStatus = "PENDENTE" | "PAGO" | "ESTORNADO" | "CANCELADO" | "ATRASADO";
export type PaymentMethod = "PIX" | "CARTAO";
export type PaymentPlan = "TOTAL" | "PARCIAL";
export type InstallmentStatus = "PENDENTE" | "PAGO" | "ATRASADO" | "CANCELADO";
export type CommissionStatus = "PENDENTE" | "APROVADA" | "PAGA" | "CANCELADA";
export type CustomerClass = "NOVO" | "RECORRENTE" | "VIP" | "INATIVO";
export type CouponType = "PERCENTUAL" | "FIXO";
export type SeatState = "DISPONIVEL" | "SELECIONADO" | "OCUPADO" | "BLOQUEADO";

export interface Profile {
  id: string;
  fullName: string;
  cpf: string;
  birthDate: string | null;
  email: string;
  phone: string | null;
  whatsapp: string | null;
  role: AppRole;
  customerClass: CustomerClass;
  referralCode: string;
  passwordHash?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Trip {
  id: string;
  name: string;
  slug: string;
  destination: string;
  category: string;
  date: string;
  departureTime: string | null;
  returnTime: string | null;
  pricePerson: number;
  priceCouple: number | null;
  totalSeats: number;
  description: string;
  itinerary: string;
  included: string;
  notIncluded: string;
  rules: string;
  cancellationPolicy: string;
  status: TripStatus;
  images: string[];
  formUrl?: string;
  formRequired?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BoardingPoint {
  id: string;
  name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  observations: string;
  active: boolean;
}

export interface TripBoardingPoint {
  id: string;
  tripId: string;
  boardingPointId: string;
  time: string;
}

export interface Seat {
  id: string;
  tripId: string;
  seatNumber: string;
  state: SeatState;
  bookingId: string | null;
}

export interface Seller {
  id: string;
  code: string;
  commissionRate: number;
}

export interface Booking {
  id: string;
  reference: string;
  customerId: string;
  tripId: string;
  sellerId: string | null;
  quantity: number;
  boardingPointId: string | null;
  boardingPoint: string | null;
  totalAmount: number;
  baseAmount: number;
  discountAmount: number;
  couponCode: string | null;
  paymentPlan: PaymentPlan;
  status: BookingStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BookingPassenger {
  id: string;
  bookingId: string;
  name: string;
  cpf: string | null;
  birthDate: string | null;
  phone: string | null;
  seatId: string | null;
  boardingPointId: string | null;
  seatGroup: string | null;
  seatAssignmentStatus: "PENDENTE" | "ATRIBUIDO" | "MANUAL";
}

export interface Payment {
  id: string;
  bookingId: string;
  customerId: string;
  method: PaymentMethod;
  plan: PaymentPlan;
  amount: number;
  status: PaymentStatus;
  gateway: string | null;
  gatewayPaymentId: string | null;
  feeAmount: number;
  netAmount: number;
  paidAt: string | null;
  pixCopyPaste: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface PaymentInstallment {
  id: string;
  bookingId: string;
  number: number;
  value: number;
  dueDate: string;
  status: InstallmentStatus;
  paidAt: string | null;
  method: PaymentMethod | null;
}

export interface Coupon {
  id: string;
  code: string;
  type: CouponType;
  value: number;
  usageLimit: number | null;
  validUntil: string | null;
  tripIds: string[];
  active: boolean;
}

export interface CouponUsage {
  id: string;
  couponId: string;
  userId: string;
  bookingId: string;
  createdAt: string;
}

export interface Commission {
  id: string;
  sellerId: string;
  bookingId: string;
  rate: number;
  amount: number;
  status: CommissionStatus;
  paidAt: string | null;
}

export interface Expense {
  id: string;
  category: string;
  amount: number;
  expenseDate: string;
  description: string;
  tripId: string | null;
  createdBy: string | null;
  createdAt: string;
}

export interface Checkin {
  id: string;
  bookingId: string;
  passengerId: string;
  checkedAt: string;
  employeeId: string;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  createdAt: string;
}

export interface Review {
  id: string;
  customerId: string;
  tripId: string;
  rating: number;
  comment: string;
  createdAt: string;
}

export interface LoyaltyPoint {
  id: string;
  customerId: string;
  points: number;
  source: string;
  bookingId: string | null;
  createdAt: string;
}

export interface Referral {
  id: string;
  referrerId: string;
  referredId: string;
  code: string;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  userId: string | null;
  action: string;
  entity: string;
  entityId: string;
  oldValue: unknown;
  newValue: unknown;
  ip: string | null;
  createdAt: string;
}

export interface BrandSettings {
  companyName: string;
  primary: string;
  secondary: string;
  background: string;
  font: string;
  fontSize: string;
  whatsapp: string;
  instagram: string;
  email: string;
  logoUrl: string;
  bannerUrl: string;
  faviconUrl: string;
}

export interface PaymentSettings {
  pixKey: string;
  pixTotalDiscount: number;
  cardWhatsapp: boolean;
  defaultCommission: number;
}

export interface SessionUser {
  id: string;
  email: string;
  fullName: string;
  role: AppRole;
}

export interface DataStore {
  profiles: Profile[];
  trips: Trip[];
  boardingPoints: BoardingPoint[];
  tripBoardingPoints: TripBoardingPoint[];
  seats: Seat[];
  sellers: Seller[];
  bookings: Booking[];
  passengers: BookingPassenger[];
  payments: Payment[];
  installments: PaymentInstallment[];
  coupons: Coupon[];
  couponUsages: CouponUsage[];
  commissions: Commission[];
  expenses: Expense[];
  checkins: Checkin[];
  notifications: Notification[];
  reviews: Review[];
  loyaltyPoints: LoyaltyPoint[];
  referrals: Referral[];
  auditLogs: AuditLog[];
  brand: BrandSettings;
  paymentSettings: PaymentSettings;
}
