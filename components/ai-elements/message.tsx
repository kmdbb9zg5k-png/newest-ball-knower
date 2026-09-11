'use client';

import {cn} from '@/lib/utils';
import {cjk} from '@streamdown/cjk';
import {code} from '@streamdown/code';
import {math} from '@streamdown/math';
import {mermaid} from '@streamdown/mermaid';
import type {UIMessage} from 'ai';
import {memo,type ComponentProps,type HTMLAttributes} from 'react';
import {Streamdown} from 'streamdown';

// Installed from the official AI Elements message registry and trimmed to the
// message primitives this app uses. Keeping these primitives local lets Ball
// Knower style the chat without loading the registry's unused action controls.
export type MessageProps=HTMLAttributes<HTMLDivElement>&{from:UIMessage['role']};
export const Message=({className,from,...props}:MessageProps)=><div className={cn('group flex w-full max-w-[95%] flex-col gap-2',from==='user'?'is-user ml-auto justify-end':'is-assistant',className)} {...props}/>;

export type MessageContentProps=HTMLAttributes<HTMLDivElement>;
export const MessageContent=({children,className,...props}:MessageContentProps)=><div className={cn('flex w-fit min-w-0 max-w-full flex-col gap-2 overflow-hidden text-sm',className)} {...props}>{children}</div>;

export type MessageResponseProps=ComponentProps<typeof Streamdown>;
const streamdownPlugins={cjk,code,math,mermaid};
export const MessageResponse=memo(({className,...props}:MessageResponseProps)=><Streamdown className={cn('size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0',className)} plugins={streamdownPlugins} {...props}/>,(previous,next)=>previous.children===next.children&&previous.isAnimating===next.isAnimating);
MessageResponse.displayName='MessageResponse';
