import { useRef, useState } from 'react'
import { ImagePlus, Loader2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { uploadFile } from '@/lib/uploads'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

type FileUploadProps = {
  /** 已上传文件的 URL（用于回显预览） */
  value?: string
  /** 上传成功后回调新的 URL；传入 null 表示清除 */
  onChange: (url: string | null) => void
  /** 接受的 MIME 类型，默认仅图片 */
  accept?: string
  /** 文件大小上限（MB），需与服务端限制保持一致 */
  maxSizeMb?: number
  className?: string
}

/**
 * 通用文件上传原语：前端校验类型/大小 → 上传到 /api/uploads → 回调预览 URL。
 * 默认渲染为圆形头像样式，可用 className 覆盖为其他形态。
 */
export function FileUpload({
  value,
  onChange,
  accept = 'image/*',
  maxSizeMb = 2,
  className,
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  async function handleSelected(file: File | undefined) {
    if (!file) return
    if (accept === 'image/*' && !file.type.startsWith('image/')) {
      toast.error('请选择图片文件。')
      return
    }
    if (file.size > maxSizeMb * 1024 * 1024) {
      toast.error(`文件大小不能超过 ${maxSizeMb}MB。`)
      return
    }

    setUploading(true)
    try {
      const uploaded = await uploadFile(file)
      onChange(uploaded.url)
    } catch {
      toast.error('上传失败，请稍后重试。')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <button
        type='button'
        className='group relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-dashed bg-muted/40'
        onClick={() => inputRef.current?.click()}
        aria-label='上传头像'
      >
        {value ? (
          <img src={value} alt='头像预览' className='size-full object-cover' />
        ) : (
          <ImagePlus className='size-5 text-muted-foreground' />
        )}
        {uploading && (
          <span className='absolute inset-0 flex items-center justify-center bg-background/70'>
            <Loader2 className='size-5 animate-spin' />
          </span>
        )}
      </button>
      <div className='flex flex-col gap-1'>
        <Button
          type='button'
          variant='outline'
          size='sm'
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? '上传中…' : '选择图片'}
        </Button>
        {value && (
          <Button
            type='button'
            variant='ghost'
            size='sm'
            className='text-muted-foreground'
            onClick={() => onChange(null)}
          >
            <Trash2 className='size-4' />
            移除
          </Button>
        )}
      </div>
      <input
        ref={inputRef}
        type='file'
        accept={accept}
        className='hidden'
        onChange={(event) => {
          void handleSelected(event.target.files?.[0])
          event.target.value = ''
        }}
      />
    </div>
  )
}
