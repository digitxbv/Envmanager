<template>
  <div class="min-h-screen grid md:grid-cols-2">
    <div class="marketing hidden md:block bg-background relative overflow-hidden">
      <div class="absolute inset-0" style="background: radial-gradient(ellipse at center, hsl(var(--primary) / 0.15), transparent 70%)" />
      <div class="absolute inset-0 hero-grid opacity-30" />
      <div class="absolute inset-0 backdrop-blur-xl" />
      <div class="absolute inset-0 flex flex-col items-center justify-center p-12 text-foreground z-10">
        <div class="flex items-center space-x-2 mb-8">
          <Icon name="lucide:terminal" class="h-12 w-12" />
          <h1 class="text-3xl font-bold">EnvManager</h1>
        </div>
        <p class="text-2xl font-medium max-w-md text-center mb-6">
          Secure management of environment variables for development teams.
        </p>
        <ul class="space-y-4 max-w-md">
           <li class="flex items-center space-x-3">
             <Icon name="lucide:check-circle" class="h-6 w-6 flex-shrink-0 text-primary" />
             <span>Securely store and manage environment variables</span>
           </li>
           <li class="flex items-center space-x-3">
             <Icon name="lucide:check-circle" class="h-6 w-6 flex-shrink-0 text-primary" />
             <span>Multiple environments per project (dev, staging, prod)</span>
           </li>
           <li class="flex items-center space-x-3">
             <Icon name="lucide:check-circle" class="h-6 w-6 flex-shrink-0 text-primary" />
             <span>Team collaboration with role-based access control</span>
           </li>
           <li class="flex items-center space-x-3">
             <Icon name="lucide:check-circle" class="h-6 w-6 flex-shrink-0 text-primary" />
             <span>Export to popular platforms like Vercel, AWS, and Render</span>
           </li>
        </ul>
      </div>
    </div>
    <div class="flex flex-col items-center justify-center p-8">
      <div class="w-full max-w-sm mx-auto space-y-6">
        <div class="mb-8 text-center md:hidden">
           <div class="flex items-center justify-center space-x-2 mb-4">
             <Icon name="lucide:terminal" class="h-8 w-8 text-primary" />
             <h1 class="text-2xl font-bold">EnvManager</h1>
           </div>
          <p class="text-lg text-muted-foreground">
            Secure management of environment variables for development teams.
          </p>
        </div>
         <div class="bg-card/80 border border-border/60 rounded-2xl p-8 backdrop-blur-xl">
           <slot />
         </div>
        <div class="text-center text-sm text-muted-foreground">
           <div class="flex justify-center space-x-4">
             <NuxtLink to="/privacy" :external="true" class="hover:text-primary hover:underline">
               Privacy Policy
             </NuxtLink>
             <NuxtLink to="/terms" :external="true" class="hover:text-primary hover:underline">
               Terms of Service
             </NuxtLink>
           </div>
        </div>
      </div>
    </div>
  </div>
</template>