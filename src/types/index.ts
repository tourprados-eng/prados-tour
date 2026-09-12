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
  | "FINALIZADA"
  | "ARQUIVADA";

export type BookingStatus = "PENDENTE" | "CONFIRMADA" | "CANCELADA" | "CONCLUIDA";
export type PaymentStatus = "PENDENTE" | "PAGO" | "ESTORNADO" | "CANCELADO" | "ATRASADO";
export type PaymentMethod = "PIX" | "CARTAO";
export type PaymentPlan = "TOTAL" | "PARCIAL";
export type InstallmentStatus = "PENDENTE" | "PAGO" | "ATRASADO" | "CANCELADO";
export type CommissionStatus = "PENDENTE" | "APROVADA" | "PAGA" | "CANCELADA";
export type CustomerClass = "NOVO" | "RECORRENTE" | "VIP" | "INATIVO";
export type CouponType = "PERCENTUAL" | "FIXO";
export type PromotionDiscountType = "PERCENTUAL" | "FIXO" | "PRECO";
export type SeatState = "DISPONIVEL" | "SELECIONADO" | "OCUPADO" | "BLOQUEADO";
export type ReviewStatus = "PENDENTE" | "APROVADO" | "REJEITADO";

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
  departureDate: string | null;
  departureTime: string | null;
  returnTime: string | null;
  returnDate?: string | null;
  pricePerson: number;
  priceCouple: number | null;
  childPrice: number | null;
  childMaxAge: number | null;
  insuranceEnabled: boolean;
  insurancePrice: number;
  transportPolicy: string | null;
  totalSeats: number;
  description: string;
  itinerary: string;
  included: string;
  notIncluded: string;
  rules: string;
  cancellationPolicy: string;
  status: TripStatus;
  images: string[];
  deletedAt?: string | null;
  formUrl?: string;
  formRequired?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BoardingPoint {
  id: string;
  name: string;
  city: string;
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
  sortOrder: number;
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
  promotionId?: string | null;
  promotionName?: string | null;
  promotionDiscount?: number;
  couponDiscount?: number;
  pixDiscount?: number;
  childCount: number;
  insuranceCount: number;
  insuranceAmount: number;
  clientRequestId?: string | null;
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
  price: number | null;
  priceCategory: "ADULTO" | "CRIANCA" | null;
  insurance: boolean;
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
  asaasExternalReference?: string | null;
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
  validFrom?: string | null;
  minAmount?: number | null;
  perUserLimit?: number | null;
  stackable?: boolean;
  description?: string | null;
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

export interface Promotion {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  discountType: PromotionDiscountType;
  discountValue: number;
  promoPricePerson: number | null;
  promoPriceCouple: number | null;
  pixDiscountPercent: number | null;
  stackable: boolean;
  couponId: string | null;
  allTrips: boolean;
  usageLimit: number | null;
  perUserLimit: number | null;
  startDate: string | null;
  endDate: string | null;
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  tripIds: string[];
}

export interface PromotionUsage {
  id: string;
  promotionId: string;
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
  status: ReviewStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
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
  phone?: string;
  whatsappMessage?: string;
  logoUrl: string;
  bannerUrl: string;
  faviconUrl: string;
  siteTagline?: string | null;
  aboutText?: string | null;
  footerText?: string | null;
}

export interface PaymentSettings {
  pixKey: string;
  pixTotalDiscount: number;
  cardWhatsapp: boolean;
  defaultCommission: number;
}

export interface PromoBannerSettings {
  title: string;
  subtitle: string;
  description: string;
  imageUrl: string;
  buttonText: string;
  buttonLink: string;
  active: boolean;
  sortOrder: number;
}

export interface VoucherSettings {
  showQr: boolean;
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
  promotions: Promotion[];
  promotionUsages: PromotionUsage[];
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
  promoBanner: PromoBannerSettings;
  voucher: VoucherSettings;
}
