import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useAuth } from "@/lib/auth-context";
import AuthLayout from "@/components/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Loader2, Eye, EyeOff, Lock, ShieldAlert } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const formSchema = z.object({
  currentPassword: z.string().min(1, { message: "Current password is required." }),
  newPassword: z.string().min(8, { message: "Password must be at least 8 characters." })
    .regex(/[A-Z]/, { message: "Must contain an uppercase letter." })
    .regex(/[0-9]/, { message: "Must contain a number." })
    .regex(/[^a-zA-Z0-9]/, { message: "Must contain a special character." }),
  confirmNewPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmNewPassword, {
  message: "Passwords do not match",
  path: ["confirmNewPassword"],
}).refine((data) => data.currentPassword !== data.newPassword, {
  message: "New password must be different from current password",
  path: ["newPassword"],
});

export default function ChangePasswordPage() {
  const { changePassword, user } = useAuth();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmNewPassword: "",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSubmitting(true);
    try {
      await changePassword(values.currentPassword, values.newPassword);
      toast({
        title: "Password Updated",
        description: "Your password has been changed. Redirecting to dashboard...",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Password Change Failed",
        description: error.message || "Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthLayout 
      title="Change Password" 
      subtitle={user?.mustChangePassword 
        ? "You must change your default password before accessing the dashboard."
        : "Update your security credentials."}
    >
      {user?.mustChangePassword && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-destructive/10 border border-destructive/20 mb-6">
          <ShieldAlert className="w-5 h-5 text-destructive shrink-0" />
          <p className="text-xs text-destructive font-mono">MANDATORY PASSWORD CHANGE REQUIRED</p>
        </div>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
          <FormField
            control={form.control}
            name="currentPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Current Password</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input 
                      data-testid="input-current-password"
                      type={showPassword ? "text" : "password"} 
                      placeholder="••••••••••••" 
                      className="pl-10 pr-10 bg-secondary/50 border-input h-11 font-mono tracking-widest text-sm" 
                      {...field} 
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="newPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="font-mono text-xs uppercase tracking-wider text-muted-foreground">New Password</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input 
                      data-testid="input-new-password"
                      type={showPassword ? "text" : "password"} 
                      placeholder="••••••••••••" 
                      className="pl-10 bg-secondary/50 border-input h-11 font-mono tracking-widest text-sm" 
                      {...field} 
                    />
                  </div>
                </FormControl>
                <FormMessage />
                <div className="text-[10px] font-mono text-muted-foreground mt-1 space-y-0.5">
                  <p>Min 8 characters, 1 uppercase, 1 number, 1 special character</p>
                </div>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="confirmNewPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Confirm New Password</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input 
                      data-testid="input-confirm-new-password"
                      type={showPassword ? "text" : "password"} 
                      placeholder="••••••••••••" 
                      className="pl-10 bg-secondary/50 border-input h-11 font-mono tracking-widest text-sm" 
                      {...field} 
                    />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button 
            data-testid="button-change-password"
            type="submit" 
            className="w-full h-11 bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-[0_0_15px_rgba(0,240,255,0.3)] transition-all duration-300 font-bold tracking-wide"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                UPDATING CREDENTIALS...
              </>
            ) : (
              "UPDATE PASSWORD"
            )}
          </Button>
        </form>
      </Form>
    </AuthLayout>
  );
}