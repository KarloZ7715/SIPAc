export default defineAppConfig({
  ui: {
    colors: {
      primary: 'sipac',
      neutral: 'slate',
    },
    icons: {
      chevronDown: 'i-lucide-chevron-down',
      external: 'i-lucide-arrow-up-right',
      upload: 'i-lucide-file-up',
    },
    card: {
      slots: {
        root: 'overflow-hidden divide-y-0 ring-0 rounded-[1.45rem] border border-border/40 bg-white/92 shadow-[0_16px_36px_-24px_rgba(17,46,29,0.12)] backdrop-blur-sm',
        header: 'border-0 p-5 sm:px-6',
        body: 'border-0 p-5 sm:p-6',
        footer: 'border-0 p-5 sm:px-6',
      },
      variants: {
        variant: {
          solid: {
            root: 'divide-y-0 ring-0 border-sipac-800/85 bg-sipac-800 text-white shadow-[0_24px_48px_-32px_rgba(18,63,40,0.42)]',
          },
          outline: {
            root: 'divide-y-0 ring-0 border-border/50 bg-white/94',
          },
          soft: {
            root: 'divide-y-0 ring-0 border-border/35 bg-surface-elevated/96',
          },
          subtle: {
            root: 'divide-y-0 ring-0 border-border/70 bg-white/90',
          },
        },
      },
      defaultVariants: {
        variant: 'subtle',
      },
    },
    badge: {
      slots: {
        base: 'inline-flex items-center gap-1 rounded-full border font-semibold tracking-[0.02em]',
      },
      variants: {
        size: {
          sm: { base: 'px-2.5 py-1 text-[11px]' },
          md: { base: 'px-3 py-1.5 text-xs' },
          lg: { base: 'px-3.5 py-1.5 text-sm' },
        },
      },
      compoundVariants: [
        {
          color: 'primary',
          variant: 'subtle',
          class: 'border-sipac-200 bg-sipac-50 text-sipac-700',
        },
        {
          color: 'primary',
          variant: 'outline',
          class: 'border-sipac-300 bg-white/70 text-sipac-700',
        },
        { color: 'neutral', variant: 'subtle', class: 'border-border bg-surface-muted text-text' },
        {
          color: 'neutral',
          variant: 'outline',
          class: 'border-border bg-white/75 text-text-muted',
        },
        {
          color: 'warning',
          variant: 'outline',
          class: 'border-earth-300 bg-earth-50/80 text-earth-700',
        },
        {
          color: 'warning',
          variant: 'subtle',
          class: 'border-earth-200 bg-earth-50 text-earth-700',
        },
        {
          color: 'success',
          variant: 'outline',
          class: 'border-sipac-300 bg-sipac-50/70 text-sipac-700',
        },
        { color: 'error', variant: 'outline', class: 'border-red-200 bg-red-50/75 text-red-700' },
      ],
      defaultVariants: {
        variant: 'subtle',
        size: 'md',
      },
    },
    alert: {
      slots: {
        root: 'w-full rounded-[1.25rem] border border-border/80 bg-white/88 p-4 shadow-[0_16px_30px_-26px_rgba(17,46,29,0.15)]',
        title: 'text-sm font-semibold text-text',
        description: 'mt-1 text-sm leading-6 text-text-muted',
        icon: 'size-5 shrink-0',
      },
      compoundVariants: [
        { color: 'neutral', variant: 'subtle', class: { root: 'border-border/80 bg-white/82' } },
        { color: 'neutral', variant: 'outline', class: { root: 'border-border bg-white/70' } },
        {
          color: 'error',
          variant: 'subtle',
          class: { root: 'border-red-200 bg-red-50/90 text-red-800' },
        },
        {
          color: 'warning',
          variant: 'subtle',
          class: { root: 'border-earth-200 bg-earth-50/85 text-earth-800' },
        },
        {
          color: 'success',
          variant: 'subtle',
          class: { root: 'border-sipac-200 bg-sipac-50/90 text-sipac-800' },
        },
      ],
      defaultVariants: {
        color: 'neutral',
        variant: 'subtle',
      },
    },
    button: {
      slots: {
        base: 'inline-flex items-center justify-center rounded-full font-semibold transition-[background-color,border-color,box-shadow,color,transform] duration-200 disabled:cursor-not-allowed disabled:opacity-70 aria-disabled:cursor-not-allowed aria-disabled:opacity-70',
      },
      compoundVariants: [
        {
          color: 'primary',
          variant: 'solid',
          class:
            'bg-sipac-700 text-white shadow-[0_18px_30px_-20px_rgba(18,63,40,0.55)] hover:bg-sipac-800 active:bg-sipac-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sipac-400',
        },
        {
          color: 'neutral',
          variant: 'ghost',
          class:
            'bg-transparent text-text hover:bg-sipac-50 hover:text-sipac-800 focus-visible:bg-sipac-50 focus-visible:ring-2 focus-visible:ring-sipac-300',
        },
        {
          color: 'neutral',
          variant: 'soft',
          class:
            'border border-border/80 bg-white/80 text-text hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-sipac-300',
        },
        {
          color: 'neutral',
          variant: 'outline',
          class:
            'border border-border bg-white/80 text-text hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-sipac-300',
        },
      ],
    },
    formField: {
      slots: {
        label: 'block font-medium text-text',
        description: 'text-text-muted',
        hint: 'text-text-muted',
        help: 'mt-2 text-text-muted',
        error: 'mt-2 text-error',
      },
    },
    input: {
      slots: {
        base: 'w-full rounded-[1.1rem] border border-border/75 bg-white/94 text-text placeholder:text-text-soft shadow-none transition-[background-color,border-color,box-shadow,color] duration-200 focus:outline-none disabled:cursor-not-allowed disabled:opacity-70',
        leadingIcon: 'text-text-soft',
        trailingIcon: 'text-text-soft',
      },
      variants: {
        variant: {
          outline: 'text-text bg-white/94 ring ring-inset ring-border/75',
          soft: 'text-text bg-surface-muted/92 ring ring-inset ring-border/65 hover:bg-white/92',
          subtle: 'text-text bg-white/90 ring ring-inset ring-border/70',
          ghost: 'text-text bg-transparent hover:bg-surface-muted/65',
          none: 'text-text bg-transparent',
        },
      },
      compoundVariants: [
        {
          color: 'neutral',
          variant: ['outline', 'subtle', 'soft'],
          class:
            'focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sipac-300 hover:ring-sipac-200/70 focus-visible:border-sipac-300',
        },
        {
          color: 'primary',
          variant: ['outline', 'subtle', 'soft'],
          class:
            'focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sipac-300 hover:ring-sipac-200/70 focus-visible:border-sipac-300',
        },
      ],
      defaultVariants: {
        color: 'neutral',
        variant: 'outline',
      },
    },
    textarea: {
      slots: {
        base: 'w-full rounded-[1.1rem] border border-border/75 bg-white/94 text-text placeholder:text-text-soft shadow-none transition-[background-color,border-color,box-shadow,color] duration-200 focus:outline-none disabled:cursor-not-allowed disabled:opacity-70',
        leadingIcon: 'text-text-soft',
        trailingIcon: 'text-text-soft',
      },
      variants: {
        variant: {
          outline: 'text-text bg-white/94 ring ring-inset ring-border/75',
          soft: 'text-text bg-surface-muted/92 ring ring-inset ring-border/65 hover:bg-white/92',
          subtle: 'text-text bg-white/90 ring ring-inset ring-border/70',
          ghost: 'text-text bg-transparent hover:bg-surface-muted/65',
          none: 'text-text bg-transparent',
        },
      },
      compoundVariants: [
        {
          color: 'neutral',
          variant: ['outline', 'subtle', 'soft'],
          class:
            'focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sipac-300 hover:ring-sipac-200/70 focus-visible:border-sipac-300',
        },
        {
          color: 'primary',
          variant: ['outline', 'subtle', 'soft'],
          class:
            'focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sipac-300 hover:ring-sipac-200/70 focus-visible:border-sipac-300',
        },
      ],
      defaultVariants: {
        color: 'neutral',
        variant: 'outline',
      },
    },
    select: {
      slots: {
        base: 'relative inline-flex items-center rounded-[1.1rem] border border-border/75 bg-white/94 text-text transition-[background-color,border-color,box-shadow,color] duration-200 focus:outline-none disabled:cursor-not-allowed disabled:opacity-70',
        content:
          'max-h-60 rounded-[1.2rem] border border-border/70 bg-white/97 shadow-[0_24px_50px_-32px_rgba(17,46,29,0.18)] backdrop-blur-md overflow-hidden flex flex-col',
        viewport:
          'relative divide-y divide-border-muted/80 scroll-py-1 overflow-y-auto flex-1 text-text',
        group: 'p-1 isolate',
        label:
          'w-full flex items-center px-2 py-1.5 text-xs font-semibold uppercase tracking-[0.06em] text-sipac-800',
        separator: 'my-1 h-px bg-border-muted',
        item: 'group relative flex items-start rounded-xl text-text transition-colors before:absolute before:inset-0 before:-z-[1] before:rounded-xl before:transition-colors data-highlighted:before:bg-sipac-50/90',
        itemLeadingIcon: 'text-text-soft group-data-highlighted:text-sipac-700',
        placeholder: 'truncate text-text-soft',
        value: 'truncate text-text',
        trailingIcon: 'text-text-soft',
      },
      variants: {
        variant: {
          outline: 'text-text bg-white/94 ring ring-inset ring-border/75',
          soft: 'text-text bg-surface-muted/92 ring ring-inset ring-border/65 hover:bg-white/92',
          subtle: 'text-text bg-white/90 ring ring-inset ring-border/70',
          ghost: 'text-text bg-transparent hover:bg-surface-muted/65',
          none: 'text-text bg-transparent',
        },
      },
      compoundVariants: [
        {
          color: 'neutral',
          variant: ['outline', 'subtle', 'soft'],
          class:
            'focus:ring-2 focus:ring-inset focus:ring-sipac-300 hover:ring-sipac-200/70 focus:border-sipac-300',
        },
        {
          color: 'primary',
          variant: ['outline', 'subtle', 'soft'],
          class:
            'focus:ring-2 focus:ring-inset focus:ring-sipac-300 hover:ring-sipac-200/70 focus:border-sipac-300',
        },
      ],
      defaultVariants: {
        color: 'neutral',
        variant: 'outline',
      },
    },
    dropdownMenu: {
      slots: {
        content:
          'min-w-44 rounded-[1.2rem] border border-border/80 bg-white/96 shadow-[0_24px_50px_-32px_rgba(17,46,29,0.24)] ring-0 overflow-hidden data-[state=open]:animate-[scale-in_120ms_ease-out] data-[state=closed]:animate-[scale-out_100ms_ease-in] origin-(--reka-dropdown-menu-content-transform-origin) flex flex-col backdrop-blur-md',
        viewport: 'relative divide-y divide-border-muted/80 scroll-py-1 overflow-y-auto flex-1',
        group: 'p-1.5 isolate',
        label: 'w-full flex items-center px-2 py-2 text-sm font-semibold text-text',
        separator: 'my-1 h-px bg-border-muted',
        item: 'group relative flex w-full items-start rounded-xl px-2.5 py-2 text-sm text-text transition-colors before:absolute before:inset-0 before:-z-[1] before:rounded-xl before:transition-colors data-highlighted:before:bg-sipac-50 data-[state=open]:before:bg-sipac-50/80',
        itemLeadingIcon:
          'text-text-soft group-data-highlighted:text-sipac-700 group-data-[state=open]:text-sipac-700',
        itemDescription: 'text-text-soft',
      },
      variants: {
        active: {
          true: {
            item: 'text-sipac-800 before:bg-sipac-50/80',
            itemLeadingIcon: 'text-sipac-600',
          },
          false: {
            item: 'text-text data-highlighted:text-text data-highlighted:before:bg-sipac-50/60 data-[state=open]:before:bg-sipac-50/60',
            itemLeadingIcon:
              'text-text-muted group-data-highlighted:text-sipac-700 group-data-[state=open]:text-sipac-700',
          },
        },
      },
    },
    fileUpload: {
      slots: {
        base: 'w-full flex-1 rounded-[1.35rem] border border-border/75 bg-white/90 p-4 shadow-none transition-[background-color,border-color,box-shadow] duration-200',
        label: 'mt-2 text-base font-semibold text-text',
        description: 'mt-1 text-sm leading-6 text-text-muted',
        file: 'rounded-[1rem] border border-border/80 bg-surface-muted/92',
        fileName: 'text-text',
        fileSize: 'text-text-soft',
      },
      variants: {
        dropzone: {
          true: 'border-dashed data-[dragging=true]:border-sipac-300 data-[dragging=true]:bg-sipac-50/45',
        },
      },
      compoundVariants: [
        { color: 'neutral', class: 'focus-visible:outline-sipac-300' },
        { color: 'neutral', highlight: true, class: 'border-sipac-300' },
        {
          interactive: true,
          disabled: false,
          class: 'hover:border-sipac-200 hover:bg-surface-muted/65',
        },
      ],
      defaultVariants: {
        color: 'neutral',
      },
    },
    table: {
      slots: {
        root: 'relative overflow-auto rounded-[1.2rem] border border-border/75 bg-white/92',
        thead: 'relative bg-surface-muted/72',
        tbody: 'divide-y divide-border-muted/70',
        tr: 'hover:bg-sipac-50/40 transition-colors',
        th: 'px-4 py-3 text-left text-xs font-semibold tracking-[0.14em] text-text-soft uppercase',
        td: 'px-4 py-3 text-sm text-text',
      },
    },
    empty: {
      slots: {
        root: 'flex flex-col items-center justify-center gap-4 rounded-[1.2rem] border border-border/70 bg-surface-muted/55 p-6 sm:p-8 min-w-0',
        avatar:
          'size-11 rounded-2xl border border-sipac-100 bg-white text-sipac-700 shadow-[0_12px_24px_-20px_rgba(18,63,40,0.25)]',
        title: 'text-base font-semibold text-text',
        description: 'text-sm leading-6 text-text-muted text-center',
      },
      defaultVariants: {
        variant: 'soft',
      },
    },
    pagination: {
      slots: {
        list: 'flex items-center gap-1.5 rounded-full border border-border/70 bg-white/88 px-2 py-1 shadow-[0_12px_28px_-22px_rgba(17,46,29,0.18)]',
        label: 'min-w-7 text-center text-sm font-medium',
      },
    },
    avatar: {
      slots: {
        root: 'inline-flex items-center justify-center shrink-0 select-none rounded-full align-middle border border-sipac-100 bg-sipac-900 text-white shadow-[0_10px_24px_-18px_rgba(18,63,40,0.55)]',
        fallback: 'font-semibold leading-none text-white truncate',
        icon: 'text-white shrink-0',
      },
    },
    modal: {
      slots: {
        overlay: 'fixed inset-0 bg-[rgba(16,35,25,0.28)] backdrop-blur-[2px]',
        content:
          'bg-white/97 border border-border/75 shadow-[0_32px_70px_-36px_rgba(17,46,29,0.26)] flex flex-col focus:outline-none rounded-[1.5rem]',
        header: 'flex items-center gap-1.5 p-5 sm:px-6 min-h-16 border-0',
        body: 'flex-1 p-5 sm:p-6 border-0',
        footer: 'flex items-center gap-1.5 p-5 sm:px-6 border-0',
        title: 'font-display text-2xl font-semibold text-text',
        description: 'mt-1 text-sm leading-6 text-text-muted',
        close: 'absolute top-4 end-4',
      },
    },
    toast: {
      slots: {
        root: 'relative group overflow-hidden rounded-[1.2rem] border border-border/75 bg-white/96 p-4 shadow-[0_24px_44px_-28px_rgba(17,46,29,0.18)] backdrop-blur-sm focus:outline-none',
        title: 'text-sm font-semibold text-text',
        description: 'text-sm leading-6 text-text-muted',
        icon: 'shrink-0 size-5',
        progress: 'absolute inset-x-0 bottom-0 h-0.5 rounded-full',
        close:
          'rounded-full p-1 text-text-soft transition-colors hover:bg-surface-muted hover:text-text',
      },
      compoundVariants: [
        {
          color: 'neutral',
          class: {
            root: 'border-border/75 bg-white/96',
            icon: 'text-sipac-700',
            progress: 'bg-sipac-300',
          },
        },
        {
          color: 'success',
          class: {
            root: 'border-sipac-200 bg-sipac-50/95',
            icon: 'text-sipac-700',
            progress: 'bg-sipac-500',
          },
        },
        {
          color: 'warning',
          class: {
            root: 'border-earth-200 bg-earth-50/95',
            icon: 'text-earth-700',
            progress: 'bg-earth-400',
          },
        },
        {
          color: 'error',
          class: {
            root: 'border-red-200 bg-red-50/96',
            icon: 'text-red-700',
            progress: 'bg-red-500',
          },
        },
        {
          color: 'info',
          class: {
            root: 'border-sky-200 bg-sky-50/96',
            icon: 'text-sky-700',
            progress: 'bg-sky-500',
          },
        },
      ],
    },
  },
})
