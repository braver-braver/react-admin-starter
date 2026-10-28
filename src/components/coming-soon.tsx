import { Telescope } from 'lucide-react'
import { t } from '@/lib/i18n'

export function ComingSoon() {
  return (
    <div className='h-svh'>
      <div className='m-auto flex h-full w-full flex-col items-center justify-center gap-2'>
        <Telescope size={72} />
        <h1 className='text-4xl leading-tight font-bold'>
          {t('comingSoonTitle')}
        </h1>
        <p className='text-center text-muted-foreground'>
          {t('comingSoonDescription')}
        </p>
      </div>
    </div>
  )
}
