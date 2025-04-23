import { Tabs, TabsList, TabsTrigger, TabsContent } from "@radix-ui/react-tabs";
import { useState } from "react";
import { json, type MetaFunction } from '@remix-run/cloudflare';
import { ClientOnly } from "remix-utils/client-only";
import { Chat } from "~/components/chat/Chat.client";
import { Header } from "~/components/header/Header";
import BackgroundRays from "~/components/ui/BackgroundRays";

export const meta: MetaFunction = () => {
  return [
    { title: 'たい焼き機工房' },
    { name: 'description', content: 'たい焼き機械の開発・製作を行う工房です' }
  ];
};

export const loader = () => json({});
export default function Index() {
  const [activeTab, setActiveTab] = useState('chat');

  return (
    <div className="flex flex-col h-full w-full bg-bolt-elements-background-depth-1 overflow-hidden">
      <BackgroundRays />
      <Header />
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
        <div className="flex justify-center pt-2 pb-1">
          <TabsList>
            <TabsTrigger value="chat">Chat</TabsTrigger>
            <TabsTrigger value="development">Development</TabsTrigger>
          </TabsList>
        </div>
        
        <TabsContent value="chat">
          <ClientOnly>{() => <Chat />}</ClientOnly>
        </TabsContent>
        
        <TabsContent value="development">
          <div className="flex items-center justify-center h-full">
            DEVELOP
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
