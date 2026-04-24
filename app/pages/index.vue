<script setup lang="ts">
import { motion } from 'motion-v'
import type {
  AcademicProductPublic,
  AuditLogPublic,
  ApiSuccessResponse,
  ProductType,
  ProfileSummaryResponse,
} from '~~/app/types'

interface AdminOverviewData {
  users: { total: number; active: number; inactive: number; admins: number; docentes: number }
  products: { total: number; confirmed: number; drafts: number; deleted: number }
  pipeline: { pending: number; processing: number; failed: number; completed: number }
  activeSessions: number
  recentActivity: AuditLogPublic[]
}

interface HomeAction {
  label: string
  to: string
  icon: string
}

interface HomePriorityMetric {
  label: string
  value: string
  note: string
}

interface HomePrioritySignal {
  label: string
  value: string
  note: string
  icon: string
}

interface HomePriorityState {
  kind:
    | 'draft_ready'
    | 'draft_review'
    | 'document_processing'
    | 'conversation_resume'
    | 'confirmed_base'
    | 'new_user'
  score: number
  eyebrow: string
  statusLabel: string
  statusTone: 'primary' | 'earth' | 'neutral'
  title: string
  summary: string
  primaryAction: HomeAction
  secondaryAction: HomeAction | null
  metrics: HomePriorityMetric[]
  focusEyebrow: string
  focusTitle: string
  focusValue: string
  focusMeta: string
  signals: HomePrioritySignal[]
}

interface HomeRailItem {
  label: string
  value: string
  note: string
  icon: string
  tone?: 'primary' | 'earth' | 'neutral'
}

interface HomeContinuationItem {
  id: string
  eyebrow: string
  title: string
  reason: string
  outcome: string
  meta: string
  icon: string
  to: string
  tone?: 'primary' | 'earth' | 'neutral'
}

interface HomeDockAction {
  title: string
  outcome: string
  to: string
  icon: string
  label?: string
  tone?: 'primary' | 'earth' | 'neutral'
  active?: boolean
}

const { user, isAdmin } = useAuth()
const chatStore = useChatStore()
const documentsStore = useDocumentsStore()
const { prefersReducedMotion, prefersMinimalMotion, densityPreference } = useUiPreferences()
const { isPageTransitionActive } = usePageMotion()

const { data: homeOverview, pending: homePending } = await useAsyncData(
  'home-overview',
  async () => {
    const requestFetch = import.meta.server ? useRequestFetch() : $fetch

    if (isAdmin.value) {
      try {
        const overview =
          await requestFetch<ApiSuccessResponse<AdminOverviewData>>('/api/admin/overview')
        return {
          profileSummary: null,
          adminOverview: overview.data,
          partialFailures: false,
        }
      } catch {
        return {
          profileSummary: null,
          adminOverview: null,
          partialFailures: true,
        }
      }
    }

    const [profileResult, conversationsResult, draftResult] = await Promise.allSettled([
      requestFetch<ApiSuccessResponse<ProfileSummaryResponse>>('/api/profile'),
      chatStore.fetchConversations(8, requestFetch),
      documentsStore.loadCurrentDraft(requestFetch),
    ])

    return {
      profileSummary: profileResult.status === 'fulfilled' ? profileResult.value.data : null,
      adminOverview: null,
      partialFailures: [profileResult, conversationsResult, draftResult].some(
        (result) => result.status === 'rejected',
      ),
    }
  },
  {
    default: () => ({
      profileSummary: null,
      adminOverview: null,
      partialFailures: false,
    }),
  },
)

const profileSummary = computed(() => homeOverview.value?.profileSummary ?? null)
const firstName = computed(() => user.value?.fullName?.split(' ')[0] || 'docente')
const totalConfirmedProducts = computed(() => profileSummary.value?.totalOwnProducts ?? 0)
const activeDraftCount = computed(
  () => profileSummary.value?.latestDrafts.length ?? (documentsStore.draftProduct ? 1 : 0),
)
const recentConversationCount = computed(() => chatStore.conversations.length)
const latestConversation = computed(() => chatStore.conversations[0] ?? null)

const activeDraft = computed(() =>
  documentsStore.draftProduct && documentsStore.workspaceStage !== 'confirmed'
    ? documentsStore.draftProduct
    : null,
)

const processingDocument = computed(() => {
  const tracked = documentsStore.activeTrackedDocument

  if (!tracked) {
    return null
  }

  return ['pending', 'processing'].includes(tracked.processingStatus) ? tracked : null
})

const baseMetrics = computed<HomePriorityMetric[]>(() => [
  {
    label: 'Confirmados',
    value: String(totalConfirmedProducts.value),
    note:
      totalConfirmedProducts.value > 0
        ? 'Ya puedes consultarlos y seguirlos.'
        : 'Aún no hay base activa.',
  },
  {
    label: 'Borradores',
    value: String(activeDraftCount.value),
    note: activeDraftCount.value > 0 ? 'Hay trabajo abierto.' : 'No hay borradores abiertos.',
  },
  {
    label: 'Consultas',
    value: String(recentConversationCount.value),
    note:
      recentConversationCount.value > 0
        ? 'Tienes una conversación reciente.'
        : 'Aún no has guardado consultas.',
  },
])

const priorityState = computed<HomePriorityState>(() => {
  const candidates: HomePriorityState[] = []

  if (activeDraft.value && documentsStore.workspaceStage === 'ready') {
    const title = getAcademicProductTitle(activeDraft.value.product) || 'Tu borrador más reciente'

    candidates.push({
      kind: 'draft_ready',
      score: 100,
      eyebrow: 'Ahora',
      statusLabel: 'Listo para confirmar',
      statusTone: 'primary',
      title: 'Tu documento ya está listo.',
      summary: `Revisa "${title}" y súmalo a tu base hoy.`,
      primaryAction: {
        label: 'Validar y confirmar',
        to: '/workspace-documents',
        icon: 'i-lucide-badge-check',
      },
      secondaryAction: {
        label: 'Abrir chat',
        to: '/chat',
        icon: 'i-lucide-sparkles',
      },
      metrics: baseMetrics.value,
      focusEyebrow: 'Documento abierto',
      focusTitle: 'Solo falta una revisión breve.',
      focusValue: title,
      focusMeta: 'Si entras ahora, puedes dejarlo confirmado en una sola pasada.',
      signals: [
        {
          label: 'Estado',
          value: 'Listo',
          note: 'Los datos principales ya están completos.',
          icon: 'i-lucide-file-check',
        },
        {
          label: 'Impacto',
          value: 'Se suma a tu base',
          note: 'Quedará disponible en el tablero y en futuras consultas.',
          icon: 'i-lucide-arrow-up-right',
        },
      ],
    })
  }

  if (activeDraft.value && ['draft', 'review'].includes(documentsStore.workspaceStage)) {
    const title = getAcademicProductTitle(activeDraft.value.product) || 'Tu borrador abierto'

    candidates.push({
      kind: 'draft_review',
      score: 90,
      eyebrow: 'Sigue aquí',
      statusLabel: 'Revisión en curso',
      statusTone: 'earth',
      title: 'Tu borrador sigue abierto.',
      summary: `Continúa "${title}" y deja cerrada la revisión.`,
      primaryAction: {
        label: 'Continuar revisión',
        to: '/workspace-documents',
        icon: 'i-lucide-file-pen-line',
      },
      secondaryAction: {
        label: 'Ver tablero',
        to: '/dashboard',
        icon: 'i-lucide-chart-column-big',
      },
      metrics: baseMetrics.value,
      focusEyebrow: 'Borrador activo',
      focusTitle: 'Terminar esto vale más que abrir algo nuevo.',
      focusValue: title,
      focusMeta: 'Una pasada corta puede dejarlo listo para confirmar.',
      signals: [
        {
          label: 'Estado',
          value: 'Falta revisar',
          note: 'Todavía hay datos por validar antes de confirmarlo.',
          icon: 'i-lucide-file-warning',
        },
        {
          label: 'Siguiente paso',
          value: 'Cerrar revisión',
          note: 'Volverás al punto exacto donde conviene seguir.',
          icon: 'i-lucide-crosshair',
        },
      ],
    })
  }

  if (processingDocument.value) {
    candidates.push({
      kind: 'document_processing',
      score: 80,
      eyebrow: 'En curso',
      statusLabel: 'Leyendo documento',
      statusTone: 'neutral',
      title: 'Tu documento se está preparando.',
      summary: `SIPAc está leyendo "${processingDocument.value.originalFilename}".`,
      primaryAction: {
        label: 'Ver progreso',
        to: '/workspace-documents',
        icon: 'i-lucide-loader-circle',
      },
      secondaryAction: {
        label: 'Ir al chat',
        to: '/chat',
        icon: 'i-lucide-sparkles',
      },
      metrics: baseMetrics.value,
      focusEyebrow: 'Lectura activa',
      focusTitle: 'Ya hay trabajo en marcha.',
      focusValue: processingDocument.value.originalFilename,
      focusMeta: 'Cuando termine, podrás revisar la ficha y dejarla lista.',
      signals: [
        {
          label: 'Estado',
          value: 'En proceso',
          note: 'Aún no conviene cargar otra acción sobre este archivo.',
          icon: 'i-lucide-hourglass',
        },
        {
          label: 'Después',
          value: 'Revisar ficha',
          note: 'Cuando termine, podrás validar el resultado sin empezar de cero.',
          icon: 'i-lucide-scan-search',
        },
      ],
    })
  }

  if (latestConversation.value) {
    candidates.push({
      kind: 'conversation_resume',
      score: 72,
      eyebrow: 'Chat activo',
      statusLabel: 'Conversación reciente',
      statusTone: 'primary',
      title: 'Sigue tu última conversación.',
      summary: `Vuelve a "${latestConversation.value.title}" y continúa desde ahí.`,
      primaryAction: {
        label: 'Abrir conversación',
        to: `/chat?id=${latestConversation.value.id}`,
        icon: 'i-lucide-sparkles',
      },
      secondaryAction: {
        label: 'Subir nuevo documento',
        to: '/workspace-documents',
        icon: 'i-lucide-folder-up',
      },
      metrics: baseMetrics.value,
      focusEyebrow: 'Último chat',
      focusTitle: 'Ya tienes un hilo abierto.',
      focusValue: latestConversation.value.title,
      focusMeta: `${latestConversation.value.messageCount} mensajes guardados para seguir sin volver a empezar.`,
      signals: [
        {
          label: 'Último movimiento',
          value: formatRelativeDate(latestConversation.value.lastMessageAt),
          note: 'El hilo sigue reciente y listo para continuar.',
          icon: 'i-lucide-history',
        },
        {
          label: 'Al abrir',
          value: 'Sigues desde ahí',
          note: 'Recuperas mensajes y referencias sin volver a empezar.',
          icon: 'i-lucide-arrow-up-right',
        },
      ],
    })
  }

  if (totalConfirmedProducts.value > 0) {
    candidates.push({
      kind: 'confirmed_base',
      score: 48,
      eyebrow: 'Panorama',
      statusLabel: 'Base confirmada',
      statusTone: 'neutral',
      title: 'Tu base ya está activa.',
      summary: 'El tablero ya puede mostrarte avance, vacíos y próximos pasos.',
      primaryAction: {
        label: 'Abrir tablero',
        to: '/dashboard',
        icon: 'i-lucide-chart-column-big',
      },
      secondaryAction: {
        label: 'Abrir chat',
        to: '/chat',
        icon: 'i-lucide-sparkles',
      },
      metrics: baseMetrics.value,
      focusEyebrow: 'Base activa',
      focusTitle: 'Ya puedes leer tu panorama.',
      focusValue: `${totalConfirmedProducts.value} documentos confirmados`,
      focusMeta: 'Entrar al tablero te ayuda a decidir dónde seguir.',
      signals: [
        {
          label: 'Mejor vista',
          value: 'Tablero personal',
          note: 'Aquí verás mejor el estado general que entrando módulo por módulo.',
          icon: 'i-lucide-chart-no-axes-column-increasing',
        },
        {
          label: 'Después',
          value: 'Priorizar mejor',
          note: 'Podrás decidir qué revisar, confirmar o consultar.',
          icon: 'i-lucide-compass',
        },
      ],
    })
  }

  candidates.push({
    kind: 'new_user',
    score: 12,
    eyebrow: 'Primer paso',
    statusLabel: homePending.value ? 'Preparando espacio' : 'Listo para empezar',
    statusTone: 'neutral',
    title: 'Empieza por tu primer documento.',
    summary: 'Es la forma más rápida de crear una base útil desde el inicio.',
    primaryAction: {
      label: 'Subir primer documento',
      to: '/workspace-documents',
      icon: 'i-lucide-folder-up',
    },
    secondaryAction: {
      label: 'Abrir chat',
      to: '/chat',
      icon: 'i-lucide-sparkles',
    },
    metrics: baseMetrics.value,
    focusEyebrow: 'Inicio',
    focusTitle: 'Todavía no hay trabajo cargado.',
    focusValue: 'Iniciar una carga guiada',
    focusMeta: 'Después de la primera carga, este inicio empezará a orientarte mejor.',
    signals: [
      {
        label: 'Mejor entrada',
        value: 'Documentos',
        note: 'Es la forma más directa de construir una base real.',
        icon: 'i-lucide-folder-plus',
      },
      {
        label: 'Después',
        value: 'Primer borrador',
        note: 'Después de eso, el inicio ya podrá sugerirte un siguiente paso.',
        icon: 'i-lucide-flag',
      },
    ],
  })

  return candidates.sort((left, right) => right.score - left.score)[0]!
})

const railItems = computed<HomeRailItem[]>(() => {
  const items: HomeRailItem[] = [
    {
      label: 'Siguiente foco',
      value:
        priorityState.value.kind === 'conversation_resume'
          ? 'Chat'
          : priorityState.value.kind === 'confirmed_base'
            ? 'Tablero'
            : 'Documentos',
      note:
        priorityState.value.kind === 'conversation_resume'
          ? 'Tu mejor entrada hoy es seguir la última conversación.'
          : priorityState.value.kind === 'confirmed_base'
            ? 'Hoy conviene mirar el panorama antes de abrir otro frente.'
            : 'Hoy conviene cerrar trabajo abierto antes de crear algo nuevo.',
      icon:
        priorityState.value.kind === 'conversation_resume'
          ? 'i-lucide-sparkles'
          : priorityState.value.kind === 'confirmed_base'
            ? 'i-lucide-chart-column-big'
            : 'i-lucide-file-check',
      tone:
        priorityState.value.kind === 'conversation_resume'
          ? 'primary'
          : priorityState.value.kind === 'confirmed_base'
            ? 'neutral'
            : 'earth',
    },
    {
      label: 'Último movimiento',
      value: latestConversation.value
        ? formatRelativeDate(latestConversation.value.lastMessageAt)
        : activeDraft.value
          ? formatRelativeDate(activeDraft.value.product.updatedAt)
          : 'Sin actividad',
      note: latestConversation.value
        ? 'Tu conversación más reciente sigue disponible.'
        : activeDraft.value
          ? 'Tu borrador más reciente sigue abierto.'
          : 'Cuando empieces a trabajar, aquí verás lo último que moviste.',
      icon: latestConversation.value ? 'i-lucide-history' : 'i-lucide-clock-3',
      tone: latestConversation.value || activeDraft.value ? 'neutral' : 'neutral',
    },
    {
      label: 'Base activa',
      value: totalConfirmedProducts.value > 0 ? String(totalConfirmedProducts.value) : 'Vacía',
      note:
        totalConfirmedProducts.value > 0
          ? 'Ya tienes material confirmado para consultar y seguir.'
          : 'Todavía no hay documentos confirmados en tu base.',
      icon: 'i-lucide-folder-check',
      tone: totalConfirmedProducts.value > 0 ? 'primary' : 'neutral',
    },
  ]

  return items
})

const continuationItems = computed<HomeContinuationItem[]>(() => {
  const items: HomeContinuationItem[] = []
  const activeDraftId = activeDraft.value?.product._id

  if (priorityState.value.kind === 'draft_ready') {
    items.push({
      id: 'priority-draft-ready',
      eyebrow: 'Ahora',
      title: 'Confirma el documento que ya está listo.',
      reason: 'Es el paso más corto para sumar otro registro a tu base.',
      outcome: 'Entrarás directo a la revisión final.',
      meta: activeDraft.value ? formatRelativeDate(activeDraft.value.product.updatedAt) : 'hoy',
      icon: 'i-lucide-badge-check',
      to: '/workspace-documents',
      tone: 'primary',
    })
  } else if (priorityState.value.kind === 'draft_review') {
    items.push({
      id: 'priority-draft-review',
      eyebrow: 'Ahora',
      title: 'Termina el borrador que ya dejaste abierto.',
      reason: 'Cerrar esto vale más que abrir otro frente.',
      outcome: 'Volverás justo al punto que falta revisar.',
      meta: activeDraft.value ? formatRelativeDate(activeDraft.value.product.updatedAt) : 'hoy',
      icon: 'i-lucide-file-pen-line',
      to: '/workspace-documents',
      tone: 'earth',
    })
  } else if (priorityState.value.kind === 'document_processing' && processingDocument.value) {
    items.push({
      id: 'priority-processing',
      eyebrow: 'Ahora',
      title: 'Sigue el documento que ya está en lectura.',
      reason: 'Ya hay trabajo en marcha; no conviene duplicarlo.',
      outcome: 'Verás el avance actual y el siguiente paso.',
      meta: processingDocument.value.originalFilename,
      icon: 'i-lucide-loader-circle',
      to: '/workspace-documents',
      tone: 'neutral',
    })
  } else if (priorityState.value.kind === 'conversation_resume' && latestConversation.value) {
    items.push({
      id: 'priority-conversation',
      eyebrow: 'Ahora',
      title: latestConversation.value.title,
      reason: 'Ya tienes una conversación abierta y lista para seguir.',
      outcome: 'Entrarás al hilo con su historial completo.',
      meta: `${latestConversation.value.messageCount} mensajes · ${formatRelativeDate(latestConversation.value.lastMessageAt)}`,
      icon: 'i-lucide-sparkles',
      to: `/chat?id=${latestConversation.value.id}`,
      tone: 'primary',
    })
  } else if (priorityState.value.kind === 'confirmed_base') {
    items.push({
      id: 'priority-dashboard',
      eyebrow: 'Ahora',
      title: 'Abre tu tablero y revisa el panorama.',
      reason: 'Tu base ya tiene suficiente material para orientar el siguiente paso.',
      outcome: 'Entrarás al tablero con una vista más clara del avance.',
      meta: `${totalConfirmedProducts.value} documentos confirmados`,
      icon: 'i-lucide-chart-column-big',
      to: '/dashboard',
      tone: 'neutral',
    })
  }

  if (latestConversation.value && priorityState.value.kind !== 'conversation_resume') {
    items.push({
      id: `conversation-${latestConversation.value.id}`,
      eyebrow: 'Chat reciente',
      title: latestConversation.value.title,
      reason: 'Sigue disponible para retomarlo sin empezar de cero.',
      outcome: 'Vuelves al hilo sin reconstruir la consulta.',
      meta: `${latestConversation.value.messageCount} mensajes · ${formatRelativeDate(latestConversation.value.lastMessageAt)}`,
      icon: 'i-lucide-sparkles',
      to: `/chat?id=${latestConversation.value.id}`,
      tone: 'primary',
    })
  }

  for (const draft of profileSummary.value?.latestDrafts ?? []) {
    if (draft._id === activeDraftId) {
      continue
    }

    items.push({
      id: `draft-${draft._id}`,
      eyebrow: 'Borrador reciente',
      title: draft.title || `Borrador de ${formatProductType(draft.productType)}`,
      reason: 'Sigue abierto y puede cerrarse con una revisión breve.',
      outcome: 'Vuelves al flujo de documentos.',
      meta: `${formatProductType(draft.productType)} · ${formatRelativeDate(draft.updatedAt)}`,
      icon: 'i-lucide-file-pen-line',
      to: '/workspace-documents',
      tone: 'earth',
    })
  }

  if (items.length === 0 && totalConfirmedProducts.value > 0) {
    items.push({
      id: 'confirmed-base',
      eyebrow: 'Base activa',
      title: 'Tu base ya puede orientar el siguiente paso.',
      reason: 'Ya tienes suficiente material para leer avance y vacíos.',
      outcome: 'Verás un panorama claro en el tablero.',
      meta: `${totalConfirmedProducts.value} documentos confirmados`,
      icon: 'i-lucide-chart-column-big',
      to: '/dashboard',
      tone: 'neutral',
    })
  }

  return items.slice(0, 4)
})

const featuredContinuation = computed(() => continuationItems.value[0] ?? null)
const continuationQueue = computed(() => continuationItems.value.slice(1, 4))

const dockActions = computed<HomeDockAction[]>(() => [
  {
    title: 'Chat',
    outcome: latestConversation.value
      ? 'Sigue tu última conversación.'
      : 'Haz consultas y vuelve a ellas después.',
    to: latestConversation.value ? `/chat?id=${latestConversation.value.id}` : '/chat',
    icon: 'i-lucide-sparkles',
    label: latestConversation.value ? 'Activo' : 'Consulta',
    tone: 'primary',
    active: priorityState.value.kind === 'conversation_resume',
  },
  {
    title: 'Documentos',
    outcome: activeDraft.value
      ? 'Sigue el borrador que ya dejaste abierto.'
      : processingDocument.value
        ? 'Revisa el avance del documento que está en lectura.'
        : 'Carga, revisa y confirma nuevos documentos.',
    to: '/workspace-documents',
    icon: 'i-lucide-folder-up',
    label: activeDraft.value || processingDocument.value ? 'En curso' : 'Revisión',
    tone: 'earth',
    active: ['draft_ready', 'draft_review', 'document_processing'].includes(
      priorityState.value.kind,
    ),
  },
  {
    title: 'Dashboard',
    outcome:
      totalConfirmedProducts.value > 0
        ? 'Lee tu panorama y decide dónde seguir.'
        : 'Aquí verás más valor cuando tu base crezca.',
    to: '/dashboard',
    icon: 'i-lucide-chart-column-big',
    label: totalConfirmedProducts.value > 0 ? 'Listo' : 'Panorama',
    tone: 'neutral',
    active: priorityState.value.kind === 'confirmed_base',
  },
  {
    title: 'Perfil',
    outcome: 'Actualiza tu cuenta y revisa tu actividad reciente.',
    to: '/profile',
    icon: 'i-lucide-user-round',
    label: 'Cuenta',
    tone: 'neutral',
  },
])

const adminOverview = computed(() => homeOverview.value?.adminOverview ?? null)

const adminHighlights = computed(() => {
  const ov = adminOverview.value
  return [
    {
      title: 'Usuarios registrados',
      value: ov?.users.total ?? 0,
      icon: 'i-lucide-users-round',
      caption: `${ov?.users.active ?? 0} activos · ${ov?.users.inactive ?? 0} inactivos`,
    },
    {
      title: 'Producción académica',
      value: ov?.products.confirmed ?? 0,
      icon: 'i-lucide-library-big',
      caption: `${ov?.products.drafts ?? 0} borradores · ${ov?.products.deleted ?? 0} eliminados`,
    },
    {
      title: 'Sesiones activas',
      value: ov?.activeSessions ?? 0,
      icon: 'i-lucide-activity',
      caption: 'Últimas 24 horas',
    },
  ]
})

const adminRecentActivity = computed(() => adminOverview.value?.recentActivity ?? [])
const adminPipeline = computed(() => adminOverview.value?.pipeline ?? null)

function formatAuditAction(action: string) {
  const labels: Record<string, string> = {
    create: 'Creó',
    update: 'Actualizó',
    delete: 'Eliminó',
    login: 'Inició sesión',
    login_failed: 'Falló login',
  }
  return labels[action] ?? action
}

function formatAuditResource(resource: string) {
  const labels: Record<string, string> = {
    academic_product: 'producto académico',
    uploaded_file: 'archivo',
    user: 'usuario',
    session: 'sesión',
    chat_conversation: 'conversación',
  }
  return labels[resource] ?? resource
}

function formatRelativeTime(isoDate: string) {
  const diff = Date.now() - new Date(isoDate).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'Justo ahora'
  if (minutes < 60) return `Hace ${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `Hace ${hours}h`
  const days = Math.floor(hours / 24)
  return `Hace ${days}d`
}

function enterMotion(delay = 0, distance = 18) {
  if (prefersMinimalMotion.value || isPageTransitionActive.value) {
    return {
      initial: false,
      animate: {},
      transition: { duration: 0 },
    }
  }

  const transition = prefersReducedMotion.value
    ? { duration: 0.16, delay: 0 }
    : { duration: 0.42, delay, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }

  return {
    initial: {
      opacity: 0,
      y: prefersReducedMotion.value ? 0 : distance,
    },
    animate: { opacity: 1, y: 0 },
    transition,
  }
}

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return `Buenos días, ${firstName.value}`
  if (hour < 18) return `Buenas tardes, ${firstName.value}`
  return `Buenas noches, ${firstName.value}`
}

function formatProductType(productType: ProductType) {
  return (
    {
      article: 'Artículo',
      thesis: 'Tesis',
      conference_paper: 'Ponencia',
      certificate: 'Certificado',
      research_project: 'Proyecto',
      book: 'Libro',
      book_chapter: 'Capítulo',
      technical_report: 'Informe',
      software: 'Software',
      patent: 'Patente',
    }[productType] ?? productType
  )
}

function formatRelativeDate(dateString: string) {
  const timestamp = new Date(dateString).getTime()

  if (Number.isNaN(timestamp)) {
    return 'hoy'
  }

  const diffMs = timestamp - Date.now()
  const diffMinutes = Math.round(diffMs / (1000 * 60))
  const diffHours = Math.round(diffMs / (1000 * 60 * 60))
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))
  const formatter = new Intl.RelativeTimeFormat('es', { numeric: 'auto' })

  if (Math.abs(diffMinutes) < 60) {
    return formatter.format(diffMinutes, 'minute')
  }

  if (Math.abs(diffHours) < 24) {
    return formatter.format(diffHours, 'hour')
  }

  return formatter.format(diffDays, 'day')
}

function getAcademicProductTitle(product: AcademicProductPublic) {
  return product.manualMetadata.title || product.extractedEntities.title?.value || ''
}
</script>

<template>
  <div
    :class="
      densityPreference === 'compact'
        ? 'space-y-5 sm:space-y-6 lg:space-y-7'
        : 'space-y-6 sm:space-y-8 lg:space-y-9'
    "
  >
    <UAlert
      v-if="homeOverview?.partialFailures && !isAdmin"
      color="warning"
      variant="subtle"
      icon="i-lucide-circle-alert"
      title="Parte del inicio no se actualizó por completo"
      description="Puedes seguir trabajando, pero algunas señales podrían tardar un poco más en reflejarse."
    />

    <template v-if="!isAdmin">
      <motion.section v-bind="enterMotion(0, 20)">
        <div
          class="grid gap-3 sm:gap-4 lg:gap-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(16rem,22rem)] lg:items-start"
        >
          <HomeWorkstage
            :eyebrow="priorityState.eyebrow"
            :status-label="priorityState.statusLabel"
            :status-tone="priorityState.statusTone"
            :title="priorityState.title"
            :summary="priorityState.summary"
            :primary-action="priorityState.primaryAction"
            :secondary-action="priorityState.secondaryAction"
            :metrics="priorityState.metrics"
            :focus-eyebrow="priorityState.focusEyebrow"
            :focus-title="priorityState.focusTitle"
            :focus-value="priorityState.focusValue"
            :focus-meta="priorityState.focusMeta"
            :signals="priorityState.signals"
          />

          <motion.div v-bind="enterMotion(0.08, 22)">
            <HomePulsePanel
              title="Tu jornada en breve."
              description="Tres señales rápidas para decidir dónde conviene entrar primero."
              :items="railItems"
            />
          </motion.div>
        </div>
      </motion.section>

      <motion.section v-bind="enterMotion(0.14, 24)">
        <HomeActivityFeed
          title="Sigue donde lo dejaste"
          description="Aquí aparece lo más útil para retomar primero."
          :featured="featuredContinuation"
          :queue="continuationQueue"
          :loading="homePending"
        />
      </motion.section>

      <motion.section
        v-bind="enterMotion(0.2, 26)"
        class="panel-surface home-dock-shell px-3 py-3 sm:px-4 sm:py-4 md:px-6"
      >
        <div class="flex flex-wrap items-end justify-between gap-4">
          <div class="space-y-1">
            <p class="text-[0.68rem] font-semibold tracking-[0.18em] text-text-soft uppercase">
              Dock de trabajo
            </p>
            <h2 class="font-display text-2xl font-medium leading-[1.2] text-text">
              Entra al espacio correcto.
            </h2>
            <p class="max-w-2xl text-sm leading-[1.6] text-text-muted">
              Usa cada módulo sin perder de vista tu prioridad principal.
            </p>
          </div>
        </div>

        <div
          class="mt-5 grid grid-cols-1 gap-3 sm:mt-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        >
          <HomeWorkspaceLauncher
            v-for="action in dockActions"
            :key="action.title"
            :title="action.title"
            :outcome="action.outcome"
            :to="action.to"
            :icon="action.icon"
            :label="action.label"
            :tone="action.tone"
            :active="action.active"
          />
        </div>
      </motion.section>
    </template>

    <template v-else>
      <ExperiencePageHero
        :eyebrow="getGreeting()"
        title="Administra SIPAc con una vista clara de la operación."
        description="Supervisa cuentas, producción académica y actividad del sistema sin perder el contexto del día."
        icon="i-lucide-compass"
      >
        <template #badges>
          <SipacBadge color="primary" variant="subtle" size="lg">
            <UIcon name="i-lucide-check-circle" class="size-3.5" />
            Administrador
          </SipacBadge>
          <SipacBadge color="neutral" variant="outline" size="lg">
            {{ user?.program || 'Universidad de Córdoba' }}
          </SipacBadge>
        </template>

        <template #actions>
          <SipacButton to="/admin/users" icon="i-lucide-users-round" size="lg">
            Gestionar usuarios
          </SipacButton>
          <SipacButton
            to="/admin/audit-logs"
            icon="i-lucide-shield-ellipsis"
            color="neutral"
            variant="soft"
            size="lg"
          >
            Auditoría
          </SipacButton>
        </template>

        <template #aside>
          <ExperienceContextPanel
            eyebrow="Resumen del día"
            title="Prioriza lo que requiere atención."
            :description="
              adminPipeline && (adminPipeline.failed > 0 || adminPipeline.pending > 0)
                ? `${adminPipeline.failed} documentos con error · ${adminPipeline.pending} pendientes de proceso.`
                : 'Todo el pipeline de documentos opera con normalidad.'
            "
            :icon="
              adminPipeline && adminPipeline.failed > 0
                ? 'i-lucide-alert-triangle'
                : 'i-lucide-activity'
            "
            :tone="adminPipeline && adminPipeline.failed > 0 ? 'earth' : 'neutral'"
          >
            <div class="flex flex-wrap gap-2">
              <SipacBadge
                v-if="adminPipeline"
                :color="adminPipeline.failed > 0 ? 'error' : 'success'"
                variant="subtle"
              >
                <UIcon
                  :name="
                    adminPipeline.failed > 0 ? 'i-lucide-alert-circle' : 'i-lucide-check-circle'
                  "
                  class="size-3"
                />
                {{ adminPipeline.failed > 0 ? `${adminPipeline.failed} errores` : 'Pipeline OK' }}
              </SipacBadge>
              <SipacBadge
                v-if="adminPipeline && adminPipeline.processing > 0"
                color="warning"
                variant="outline"
              >
                {{ adminPipeline.processing }} procesando
              </SipacBadge>
              <SipacBadge v-if="adminPipeline" color="neutral" variant="outline">
                {{ adminPipeline.completed }} completados
              </SipacBadge>
            </div>
          </ExperienceContextPanel>
        </template>
      </ExperiencePageHero>

      <section class="grid gap-4 lg:grid-cols-3">
        <ExperienceStatCard
          v-for="(highlight, index) in adminHighlights"
          :key="highlight.title"
          :class="`fade-up stagger-${index + 1}`"
          :label="highlight.title"
          :value="highlight.value"
          :icon="highlight.icon"
          :caption="highlight.caption"
        />
      </section>

      <section
        class="grid gap-4 sm:gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.6fr)] xl:grid-cols-[minmax(0,1.2fr)_minmax(22rem,0.8fr)]"
      >
        <SipacCard class="fade-up stagger-2">
          <template #header>
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 class="font-display text-2xl font-medium leading-[1.2] text-text">
                  Actividad reciente
                </h2>
                <p class="mt-1 text-sm text-text-muted">
                  Últimas acciones registradas en el sistema.
                </p>
              </div>
              <SipacButton
                to="/admin/audit-logs"
                icon="i-lucide-arrow-right"
                trailing
                color="neutral"
                variant="soft"
              >
                Ver todo
              </SipacButton>
            </div>
          </template>

          <div v-if="homePending" class="grid gap-3">
            <div
              v-for="index in 4"
              :key="index"
              class="h-14 rounded-2xl skeleton-shimmer bg-surface-muted"
            />
          </div>

          <div v-else-if="adminRecentActivity.length" class="space-y-2.5">
            <div
              v-for="log in adminRecentActivity"
              :key="log._id"
              class="flex items-start gap-3 rounded-xl border border-border/60 bg-surface-muted/50 px-4 py-3 transition-colors hover:bg-surface-muted"
            >
              <span
                class="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl bg-sipac-50 text-sipac-700"
              >
                <UIcon
                  :name="
                    log.action === 'login'
                      ? 'i-lucide-log-in'
                      : log.action === 'create'
                        ? 'i-lucide-plus'
                        : log.action === 'delete'
                          ? 'i-lucide-trash-2'
                          : 'i-lucide-pencil'
                  "
                  class="size-4"
                />
              </span>
              <div class="min-w-0 flex-1">
                <p class="text-sm text-text">
                  <span class="font-semibold">{{ log.userName }}</span>
                  {{ ' ' }}
                  <span class="text-text-muted">
                    {{ formatAuditAction(log.action) }} {{ formatAuditResource(log.resource) }}
                  </span>
                </p>
                <p v-if="log.details" class="mt-0.5 truncate text-xs text-text-muted">
                  {{ log.details }}
                </p>
              </div>
              <span class="shrink-0 text-xs text-text-soft">
                {{ formatRelativeTime(log.createdAt) }}
              </span>
            </div>
          </div>

          <UEmpty
            v-else
            icon="i-lucide-activity"
            title="Sin actividad reciente"
            description="Cuando se registren acciones en el sistema, aparecerán aquí."
          />
        </SipacCard>

        <div class="space-y-4 fade-up stagger-3">
          <ExperienceContextPanel
            eyebrow="Accesos rápidos"
            title="Entra directo al módulo correcto."
            description="Usa estos accesos para navegar sin pasar por el sidebar."
            icon="i-lucide-compass"
            tone="earth"
          >
            <div class="space-y-2">
              <SipacButton
                to="/admin/users"
                variant="soft"
                color="neutral"
                size="sm"
                block
                icon="i-lucide-users-round"
              >
                Gestión de usuarios
              </SipacButton>
              <SipacButton
                to="/dashboard"
                variant="soft"
                color="neutral"
                size="sm"
                block
                icon="i-lucide-chart-column-big"
              >
                Dashboard analítico
              </SipacButton>
              <SipacButton
                to="/repository"
                variant="soft"
                color="neutral"
                size="sm"
                block
                icon="i-lucide-library-big"
              >
                Repositorio académico
              </SipacButton>
              <SipacButton
                to="/admin/audit-logs"
                variant="soft"
                color="neutral"
                size="sm"
                block
                icon="i-lucide-shield-ellipsis"
              >
                Registros de auditoría
              </SipacButton>
            </div>
          </ExperienceContextPanel>

          <ExperienceContextPanel
            v-if="adminOverview?.users"
            eyebrow="Distribución de roles"
            title="Composición del equipo."
            icon="i-lucide-pie-chart"
            tone="primary"
          >
            <div class="space-y-2">
              <div class="flex items-center justify-between text-sm">
                <span class="text-text-muted">Docentes</span>
                <span class="font-semibold text-text">{{ adminOverview.users.docentes }}</span>
              </div>
              <div class="flex items-center justify-between text-sm">
                <span class="text-text-muted">Administradores</span>
                <span class="font-semibold text-text">{{ adminOverview.users.admins }}</span>
              </div>
              <div class="mt-2 h-2 overflow-hidden rounded-full bg-surface-muted">
                <div
                  class="h-full rounded-full bg-sipac-500 transition-all duration-500"
                  :style="{
                    width:
                      adminOverview.users.total > 0
                        ? `${(adminOverview.users.docentes / adminOverview.users.total) * 100}%`
                        : '0%',
                  }"
                />
              </div>
            </div>
          </ExperienceContextPanel>
        </div>
      </section>
    </template>
  </div>
</template>
