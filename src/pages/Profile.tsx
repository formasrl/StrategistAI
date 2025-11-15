import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/integrations/supabase/SessionContextProvider';
import { showError, showSuccess } from '@/utils/toast';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User } from 'lucide-react';
import { Profile as UserProfileType } from '@/types/supabase';
import { Skeleton } from '@/components/ui/skeleton';

const formSchema = z.object({
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  avatar_url: z.string().url('Must be a valid URL').optional().or(z.literal('')),
});

const Profile: React.FC = () => {
  const { user, isLoading: isSessionLoading } = useSession();
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      first_name: '',
      last_name: '',
      avatar_url: '',
    },
  });

  // Effect to fetch user profile from Supabase
  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) {
        setIsLoadingProfile(false);
        return;
      }

      setIsLoadingProfile(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (error) {
        showError(`Failed to load profile: ${error.message}`);
      } else if (data) {
        form.reset({
          first_name: data.first_name || '',
          last_name: data.last_name || '',
          avatar_url: data.avatar_url || '',
        });
      }
      setIsLoadingProfile(false);
    };

    if (!isSessionLoading) {
      fetchProfile();
    }
  }, [user, isSessionLoading, form]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!user) {
      showError('You must be logged in to update your profile.');
      return;
    }

    const { error } = await supabase
      .from('profiles')
      .upsert(
        {
          id: user.id,
          first_name: values.first_name || null,
          last_name: values.last_name || null,
          avatar_url: values.avatar_url || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      );

    if (error) {
      showError(`Failed to save profile: ${error.message}`);
    } else {
      showSuccess('Profile updated successfully!');
    }
  };

  if (isSessionLoading || isLoadingProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-white">
        <p className="text-xl">Loading Profile...</p>
      </div>
    );
  }

  const currentAvatarUrl = form.watch('avatar_url');
  const firstName = form.watch('first_name');
  const lastName = form.watch('last_name');

  const getInitials = (fName?: string, lName?: string) => {
    const initialF = fName ? fName.charAt(0) : '';
    const initialL = lName ? lName.charAt(0) : '';
    return (initialF + initialL).toUpperCase();
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="text-2xl font-bold">User Profile</CardTitle>
        <CardDescription>Manage your personal information.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="flex items-center space-x-4">
              <Avatar className="h-20 w-20">
                {currentAvatarUrl ? (
                  <AvatarImage src={currentAvatarUrl} alt="User Avatar" />
                ) : (
                  <AvatarFallback>
                    {getInitials(firstName, lastName) || <User className="h-10 w-10 text-muted-foreground" />}
                  </AvatarFallback>
                )}
              </Avatar>
              <div className="flex-1">
                <FormField
                  control={form.control}
                  name="avatar_url"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Avatar URL (Optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="https://example.com/avatar.jpg" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <FormField
              control={form.control}
              name="first_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>First Name (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="John" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="last_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Last Name (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Doe" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit">Save Profile</Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};

export default Profile;