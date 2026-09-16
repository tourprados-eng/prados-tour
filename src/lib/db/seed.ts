import bcrypt from "bcryptjs";
import { v4 as uuid } from "uuid";
import type { DataStore } from "@/types";

const PASSWORD = "Prados@123";

export async function createSeedStore(): Promise<DataStore> {
  const hash = await bcrypt.hash(PASSWORD, 10);
  const now = new Date().toISOString();

  const adminId = uuid();
  const sellerId = uuid();
  const monitorId = uuid();
  const financeId = uuid();
  const client1 = uuid();
  const client2 = uuid();

  const bp1 = uuid();
  const bp2 = uuid();
  const bp3 = uuid();
  const bp4 = uuid();

  const trip1 = uuid();
  const trip2 = uuid();
  const trip3 = uuid();

  const profiles = [
    {
      id: adminId,
      fullName: "Mayara Prado",
      cpf: "11144477735",
      birthDate: "1990-05-12",
      email: "admin@pradostour.com",
      phone: "11998639502",
      whatsapp: "11998639502",
      role: "SUPER_ADMIN" as const,
      customerClass: "VIP" as const,
      referralCode: "MAYARA10",
      passwordHash: hash,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: sellerId,
      fullName: "Maria Vendedora",
      cpf: "39053344705",
      birthDate: "1992-03-20",
      email: "vendedor@pradostour.com",
      phone: "11988887777",
      whatsapp: "11988887777",
      role: "VENDEDOR" as const,
      customerClass: "RECORRENTE" as const,
      referralCode: "MARIA10",
      passwordHash: hash,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: monitorId,
      fullName: "Carlos Monitor",
      cpf: "52998224725",
      birthDate: "1988-08-08",
      email: "monitor@pradostour.com",
      phone: "11977776666",
      whatsapp: "11977776666",
      role: "MONITOR" as const,
      customerClass: "NOVO" as const,
      referralCode: "CARLOS10",
      passwordHash: hash,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: financeId,
      fullName: "Ana Financeiro",
      cpf: "15350946056",
      birthDate: "1985-01-15",
      email: "financeiro@pradostour.com",
      phone: "11966665555",
      whatsapp: "11966665555",
      role: "FINANCEIRO" as const,
      customerClass: "NOVO" as const,
      referralCode: "ANA10",
      passwordHash: hash,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: client1,
      fullName: "João Cliente",
      cpf: "88621577949",
      birthDate: "1995-11-02",
      email: "cliente@pradostour.com",
      phone: "11955554444",
      whatsapp: "11955554444",
      role: "CLIENTE" as const,
      customerClass: "RECORRENTE" as const,
      referralCode: "JOAO10",
      passwordHash: hash,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: client2,
      fullName: "Fernanda Silva",
      cpf: "23100299900",
      birthDate: "1998-07-22",
      email: "fernanda@email.com",
      phone: "11944443333",
      whatsapp: "11944443333",
      role: "CLIENTE" as const,
      customerClass: "NOVO" as const,
      referralCode: "FER10",
      passwordHash: hash,
      createdAt: now,
      updatedAt: now,
    },
  ];

  const boardingPoints = [
    {
      id: bp1,
      name: "SAN Fazendinha",
      city: "Santana de Parnaíba",
      address: "Santana de Parnaíba - SP",
      latitude: -23.444,
      longitude: -46.918,
      observations: "Ponto de referência",
      active: true,
    },
    {
      id: bp2,
      name: "Anhanguera Parque Shopping",
      city: "Cajamar",
      address: "Cajamar - SP",
      latitude: -23.493,
      longitude: -46.761,
      observations: "Embarque na entrada principal",
      active: true,
    },
    {
      id: bp3,
      name: "Ginásio de Esportes do Polvilho",
      city: "Cajamar",
      address: "Cajamar - SP",
      latitude: -23.356,
      longitude: -46.876,
      observations: "Estacionamento amplo",
      active: true,
    },
    {
      id: bp4,
      name: "Barra Funda",
      city: "São Paulo",
      address: "São Paulo - SP",
      latitude: -23.525,
      longitude: -46.667,
      observations: "Tagipuru / Memorial da América Latina",
      active: true,
    },
  ];

  const trips = [
    {
      id: trip1,
      name: "Ilhabela",
      slug: "ilhabela",
      destination: "Ilhabela - SP",
      category: "Praia",
      date: "2026-09-06",
      departureDate: "2026-09-06",
      departureTime: "22:10",
      returnTime: "20:00",
      returnDate: "2026-09-07",
      pricePerson: 180,
      priceCouple: 340,
      childPrice: 120,
      childMaxAge: 5,
      insuranceEnabled: true,
      insurancePrice: 20,
      transportPolicy:
        "Ida e volta em ônibus executivo. Cada passageiro tem direito a uma poltrona. Menores de 10 anos ficam acompanhados do responsável.",
      totalSeats: 46,
      description:
        "Excursão bate-volta para Ilhabela com tempo livre nas praias e estrutura completa da Prado's Tour.",
      itinerary:
        "Saída noturna → Travessia de ferry → Praias → Tempo livre → Retorno no final do dia.",
      included: "Transporte ida e volta, monitor acompanhante, seguro básico.",
      notIncluded: "Alimentação, ferry (quando cobrado no local), despesas pessoais.",
      rules: "Documentos obrigatórios. Menores acompanhados de responsável.",
      cancellationPolicy: "Cancelamento com reembolso parcial até 7 dias antes da viagem.",
      status: "PUBLICADA" as const,
      images: ["/images/guaruja.png"],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: trip2,
      name: "Guarujá",
      slug: "guaruja",
      destination: "Guarujá - SP",
      category: "Praia",
      date: "2026-09-20",
      departureDate: "2026-09-20",
      departureTime: "05:00",
      returnTime: "19:30",
      returnDate: "2026-09-20",
      pricePerson: 150,
      priceCouple: 280,
      childPrice: null,
      childMaxAge: null,
      insuranceEnabled: false,
      insurancePrice: 20,
      transportPolicy:
        "Ida e volta em ônibus executivo. Chegar com 20 minutos de antecedência no ponto de embarque.",
      totalSeats: 46,
      description: "Dia de praia no Guarujá com embarque em pontos estratégicos da Grande São Paulo.",
      itinerary: "Embarque matinal → Praia → Tempo livre → Retorno à noite.",
      included: "Ônibus executivo, monitor, kit boas-vindas.",
      notIncluded: "Alimentação e cadeiras de praia.",
      rules: "Chegar com 20 minutos de antecedência no ponto.",
      cancellationPolicy: "Regras padrão Prado's Tour.",
      status: "PUBLICADA" as const,
      images: ["/images/guaruja.png"],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: trip3,
      name: "Paraty Histórica",
      slug: "paraty-historica",
      destination: "Paraty - RJ",
      category: "Turismo cultural",
      date: "2026-10-11",
      departureDate: "2026-10-11",
      departureTime: "23:00",
      returnTime: "21:00",
      returnDate: "2026-10-12",
      pricePerson: 220,
      priceCouple: 420,
      childPrice: null,
      childMaxAge: null,
      insuranceEnabled: false,
      insurancePrice: 20,
      transportPolicy:
        "Ida e volta em ônibus executivo. Calçado confortável recomendado para o city tour.",
      totalSeats: 40,
      description: "City tour pelo centro histórico de Paraty com tempo livre e fotos.",
      itinerary: "Saída noturna → Centro histórico → Tempo livre → Retorno.",
      included: "Transporte, monitor e mapa turístico.",
      notIncluded: "Passeios de barco e refeições.",
      rules: "Calçado confortável recomendado.",
      cancellationPolicy: "Até 10 dias antes com análise administrativa.",
      status: "PUBLICADA" as const,
      images: ["/images/paraty.png"],
      createdAt: now,
      updatedAt: now,
    },
  ];

  const tripBoardingPoints = [
    { id: uuid(), tripId: trip1, boardingPointId: bp1, time: "22:10", sortOrder: 0 },
    { id: uuid(), tripId: trip1, boardingPointId: bp2, time: "22:20", sortOrder: 1 },
    { id: uuid(), tripId: trip1, boardingPointId: bp3, time: "22:30", sortOrder: 2 },
    { id: uuid(), tripId: trip1, boardingPointId: bp4, time: "23:30", sortOrder: 3 },
    { id: uuid(), tripId: trip2, boardingPointId: bp1, time: "05:00", sortOrder: 0 },
    { id: uuid(), tripId: trip2, boardingPointId: bp2, time: "05:20", sortOrder: 1 },
    { id: uuid(), tripId: trip2, boardingPointId: bp3, time: "05:35", sortOrder: 2 },
    { id: uuid(), tripId: trip3, boardingPointId: bp2, time: "23:00", sortOrder: 0 },
    { id: uuid(), tripId: trip3, boardingPointId: bp4, time: "23:40", sortOrder: 1 },
  ];

  const seats: DataStore["seats"] = [];
  for (const trip of trips) {
    for (let i = 1; i <= trip.totalSeats; i++) {
      seats.push({
        id: uuid(),
        tripId: trip.id,
        seatNumber: String(i).padStart(2, "0"),
        state: "DISPONIVEL",
        bookingId: null,
      });
    }
  }

  const bookingId = uuid();
  const passengerId = uuid();
  const seat = seats.find((s) => s.tripId === trip1)!;
  seat.state = "OCUPADO";
  seat.bookingId = bookingId;

  return {
    profiles,
    trips,
    boardingPoints,
    tripBoardingPoints,
    seats,
    sellers: [{ id: sellerId, code: "VD001", commissionRate: 0.1 }],
    bookings: [
      {
        id: bookingId,
        reference: "PT000001",
        customerId: client1,
        tripId: trip1,
        sellerId: sellerId,
        quantity: 1,
        boardingPointId: bp1,
        boardingPoint: "SAN Fazendinha",
        totalAmount: 180,
        baseAmount: 180,
        discountAmount: 0,
        couponCode: null,
        childCount: 0,
        insuranceCount: 0,
        insuranceAmount: 0,
        paymentPlan: "TOTAL",
        status: "CONFIRMADA",
        notes: null,
        createdAt: now,
        updatedAt: now,
      },
    ],
    passengers: [
      {
        id: passengerId,
        bookingId,
        name: "João Cliente",
        cpf: "88621577949",
        birthDate: "1995-11-02",
        phone: "11955554444",
        seatId: seat.id,
        boardingPointId: bp1,
        seatGroup: null,
        price: 180,
        priceCategory: "ADULTO",
        insurance: false,
        seatAssignmentStatus: "ATRIBUIDO",
      },
    ],
    payments: [
      {
        id: uuid(),
        bookingId,
        customerId: client1,
        method: "PIX",
        plan: "TOTAL",
        amount: 180,
        status: "PAGO",
        gateway: "demo",
        gatewayPaymentId: "demo-paid-1",
        feeAmount: 0,
        netAmount: 180,
        paidAt: now,
        pixCopyPaste: null,
        metadata: {},
        createdAt: now,
      },
    ],
    installments: [
      {
        id: uuid(),
        bookingId,
        number: 1,
        value: 180,
        dueDate: now.slice(0, 10),
        status: "PAGO",
        paidAt: now,
        method: "PIX",
      },
    ],
    coupons: [
      {
        id: uuid(),
        code: "PRADOS10",
        type: "PERCENTUAL",
        value: 10,
        usageLimit: 100,
        validUntil: "2026-12-31T23:59:59.000Z",
        tripIds: [],
        active: true,
      },
    ],
    couponUsages: [],
    commissions: [
      {
        id: uuid(),
        sellerId,
        bookingId,
        rate: 0.1,
        amount: 18,
        status: "PENDENTE",
        paidAt: null,
      },
    ],
    expenses: [
      {
        id: uuid(),
        category: "Transporte",
        amount: 2500,
        expenseDate: "2026-09-01",
        description: "Locação ônibus Ilhabela",
        tripId: trip1,
        createdBy: financeId,
        createdAt: now,
      },
    ],
    checkins: [],
    notifications: [
      {
        id: uuid(),
        userId: client1,
        title: "Reserva confirmada",
        message: "Sua reserva PT000001 para Ilhabela está confirmada.",
        type: "RESERVA",
        read: false,
        createdAt: now,
      },
    ],
    reviews: [],
    galleryPhotos: [],
    loyaltyPoints: [
      {
        id: uuid(),
        customerId: client1,
        points: 180,
        source: "RESERVA",
        bookingId,
        createdAt: now,
      },
    ],
    referrals: [],
    auditLogs: [],
    brand: {
      companyName: "Prado's Tour",
      primary: "#E84C91",
      secondary: "#F28C28",
      background: "#FFF9FC",
      font: "Arial",
      fontSize: "16",
      whatsapp: "5511998639502",
      instagram: "pradostour",
      email: "contato@pradostour.com",
      phone: "11998639502",
      whatsappMessage:
        "Olá! Vim pelo site da Prado's Tour e gostaria de mais informações.",
      logoUrl: "/images/logo.png",
      bannerUrl: "/images/guaruja.png",
      faviconUrl: "/favicon.ico",
      siteTagline:
        "Reserve praias, parques e bate-voltas com conforto, cuidado e segurança.",
      aboutText:
        "Somos uma agência de turismo especializada em excursões bate-volta, praias, parques, day use, trilhas, cachoeiras, turismo religioso, eventos e viagens especiais. Cuidamos de cada detalhe para que você aproveite o passeio com tranquilidade.",
      footerText:
        "A Prado's Tour leva você para os melhores destinos com conforto, segurança e toda a organização que merece.",
    },
    paymentSettings: {
      pixKey: "f8e32f48-9b97-41fa-aec0-db8ae91da403",
      pixTotalDiscount: 0.02,
      cardWhatsapp: true,
      defaultCommission: 0.1,
    },
    voucher: {
      showQr: true,
    },
    promotions: [],
    promotionUsages: [],
    promoBanner: {
      title: "Ofertas e promoções",
      subtitle: "Condições especiais por tempo limitado",
      description: "",
      imageUrl: "",
      buttonText: "Ver ofertas",
      buttonLink: "/ofertas",
      active: false,
      sortOrder: 0,
    },
  };
}
