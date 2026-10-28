import { PanelsTopLeft } from 'lucide-react'
import { appConfig } from '@/config/app'

type AuthLayoutProps = {
  children: React.ReactNode
}

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className='container grid min-h-svh max-w-none items-center justify-center'>
      <div className='mx-auto flex w-full flex-col justify-center space-y-2 py-8 sm:p-8'>
        <div className='mb-4 flex items-center justify-center gap-2'>
          <PanelsTopLeft className='size-7' />
          <h1 className='text-xl font-medium'>{appConfig.name}</h1>
        </div>
        {children}
      </div>
    </div>
  )
}
