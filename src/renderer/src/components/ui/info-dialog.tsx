import { Info } from 'lucide-react'
import { Button } from './button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './dialog'

interface InfoDialogProps {
  title: string
  description: React.ReactNode
  className?: string
}

function InfoDialog({ title, description, className }: InfoDialogProps): React.JSX.Element {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={`h-4 w-4 shrink-0 text-muted-foreground hover:text-foreground ${className || ''}`}
        >
          <Info className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[350px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="text-sm text-muted-foreground">{description}</div>
      </DialogContent>
    </Dialog>
  )
}

export default InfoDialog
