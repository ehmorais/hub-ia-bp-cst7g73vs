import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useAuth } from '@/hooks/use-auth'
import pb from '@/lib/pocketbase/client'
import { useToast } from '@/components/ui/use-toast'
import { User } from 'lucide-react'

export default function Profile() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [name, setName] = useState(user?.name || '')
  const [avatar, setAvatar] = useState<File | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const avatarUrl = avatar
    ? URL.createObjectURL(avatar)
    : user?.avatar
      ? pb.files.getUrl(user, user.avatar, { thumb: '100x100' })
      : ''
  const initials = (name || user?.email || 'U')
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase()

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      const formData = new FormData()
      formData.append('name', name)
      if (avatar) {
        formData.append('avatar', avatar)
      }

      await pb.collection('users').update(user.id, formData)
      await pb.collection('users').authRefresh()

      toast({ title: 'Sucesso', description: 'Perfil atualizado com sucesso.' })
    } catch (err: any) {
      toast({
        title: 'Erro',
        description: err.message || 'Erro ao atualizar perfil',
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="container mx-auto p-4 md:p-8 space-y-8 max-w-3xl animate-fade-in">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-3">
          <User className="h-8 w-8 text-primary" />
          Meu Perfil
        </h1>
        <p className="text-muted-foreground text-lg">
          Gerencie suas informações pessoais e foto de perfil.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Informações Básicas</CardTitle>
          <CardDescription>
            Atualize seu nome e foto de perfil. Essas informações serão exibidas em todo o sistema.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-6">
            <div className="flex items-center gap-6">
              <Avatar className="h-24 w-24 border border-primary/20 shadow-sm">
                <AvatarImage src={avatarUrl} className="object-cover" />
                <AvatarFallback className="text-2xl font-semibold bg-primary/5 text-primary">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="space-y-2">
                <Label htmlFor="avatar-upload" className="cursor-pointer">
                  <div className="bg-secondary text-secondary-foreground hover:bg-secondary/80 inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-10 px-4 py-2">
                    Mudar Foto
                  </div>
                </Label>
                <Input
                  id="avatar-upload"
                  type="file"
                  accept="image/png, image/jpeg, image/webp"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setAvatar(e.target.files[0])
                    }
                  }}
                />
                <p className="text-xs text-muted-foreground font-medium">
                  JPG, PNG ou WEBP. Max 5MB.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Nome de Exibição</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Seu nome completo"
                className="max-w-md"
              />
            </div>

            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                value={user?.email || ''}
                disabled
                className="max-w-md bg-slate-50 text-slate-500 cursor-not-allowed"
              />
              <p className="text-xs text-muted-foreground">
                O email de acesso não pode ser alterado.
              </p>
            </div>

            <Button type="submit" disabled={isSubmitting} className="min-w-32">
              {isSubmitting ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
