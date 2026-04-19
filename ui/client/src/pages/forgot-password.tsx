import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Link } from "wouter";
import AuthLayout from "@/components/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Loader2, Mail, ArrowLeft, CheckCircle2 } from "lucide-react";

const formSchema = z.object({
  email: z.string().email({ message: "Invalid enterprise email address." }),
});

export default function ForgotPasswordPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [isSent, setIsSent] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    // Simulate API
    await new Promise(resolve => setTimeout(resolve, 1500));
    setIsLoading(false);
    setIsSent(true);
  }

  if (isSent) {
    return (
       <AuthLayout 
        title="Check your inbox" 
        subtitle="We've sent password reset instructions to your email."
      >
        <div className="flex flex-col items-center justify-center space-y-6 py-8">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <p className="text-center text-muted-foreground">
            If an account exists for <span className="text-foreground font-medium">{form.getValues("email")}</span>, 
            you will receive an email shortly.
          </p>
          <Button 
            asChild 
            variant="outline" 
            className="w-full h-11 border-primary/20 hover:bg-primary/5 text-primary"
          >
            <Link href="/auth/login">Return to Login</Link>
          </Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout 
      title="Reset Password" 
      subtitle="Enter your email to receive recovery instructions."
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Work Email</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input 
                      placeholder="analyst@netspectre.ai" 
                      className="pl-10 bg-secondary/50 border-input h-11" 
                      {...field} 
                    />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button 
            type="submit" 
            className="w-full h-11 bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-[0_0_15px_rgba(0,240,255,0.3)] transition-all duration-300 font-bold tracking-wide"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                SENDING LINK...
              </>
            ) : (
              "SEND RESET LINK"
            )}
          </Button>

          <div className="text-center pt-2">
            <Link href="/auth/login" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Login
            </Link>
          </div>
        </form>
      </Form>
    </AuthLayout>
  );
}