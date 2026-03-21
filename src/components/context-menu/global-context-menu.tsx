"use client";

import * as React from "react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";

import { useUIStore } from "@/store/ui-store";
import { 
  FolderPlus, 
  FileUp, 
  FolderUp, 
  FileText, 
  Table, 
  Presentation, 
  PlaySquare, 
  ListTodo,
  Upload
} from "lucide-react";

interface SharedDriveMenuItemsProps {
  Item: React.ElementType;
  Separator: React.ElementType;
  Sub: React.ElementType;
  SubTrigger: React.ElementType;
  SubContent: React.ElementType;
  folderInputRef?: React.RefObject<HTMLInputElement | null>;
}

export function SharedDriveMenuItems({
  Item,
  Separator,
  Sub,
  SubTrigger,
  SubContent,
  folderInputRef,
}: SharedDriveMenuItemsProps) {
  const { setNewFolderModalOpen, openFilePicker, openFolderPicker } = useUIStore();

  const itemClass = "cursor-pointer flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 focus:bg-[#f1f3f4] dark:focus:bg-gray-800";
  const subTriggerClass = "cursor-pointer flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 focus:bg-[#f1f3f4] dark:focus:bg-gray-800 h-auto";
  const iconClass = "w-[18px] h-[18px] text-[#5f6368] dark:text-gray-400";
  const appIconClass = "w-[18px] h-[18px]";
  const labelClass = "flex-1 text-[14px]";
  const shortcutClass = "text-[11px] text-[#5f6368] dark:text-gray-500";
  const subContentClass = "w-48 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 rounded-lg p-1.5 shadow-md ml-1";
  const subItemClass = "cursor-pointer px-3 py-2 text-[14px] rounded-md hover:bg-gray-100 dark:hover:bg-gray-800";

  return (
    <>
      <Item className={itemClass} onClick={() => setNewFolderModalOpen(true)}>
        <FolderPlus className={iconClass} />
        <span className={labelClass}>New folder</span>
        <span className={shortcutClass}>Alt+C then F</span>
      </Item>

      <Separator className="my-1 border-gray-200 dark:border-gray-800" />

      <Item className={itemClass} onClick={() => openFilePicker?.()}>
        <Upload className={iconClass} />
        <span className={labelClass}>File upload</span>
        <span className={shortcutClass}>Alt+C then U</span>
      </Item>

      <Item className={itemClass} onClick={() => openFolderPicker?.() || folderInputRef?.current?.click()}>
        <FolderUp className={iconClass} />
        <span className={labelClass}>Folder upload</span>
        <span className={shortcutClass}>Alt+C then I</span>
      </Item>

      <Separator className="my-1 border-gray-200 dark:border-gray-800" />

      <Sub>
        <SubTrigger className={subTriggerClass}>
          <FileText className={`${appIconClass} text-[#4285F4]`} fill="#4285F4" fillOpacity={0.2} />
          <span className={labelClass}>Google Docs</span>
        </SubTrigger>
        <SubContent className={subContentClass}>
           <Item className={subItemClass}>Blank document</Item>
           <Item className={subItemClass}>From a template</Item>
        </SubContent>
      </Sub>

      <Sub>
        <SubTrigger className={subTriggerClass}>
          <Table className={`${appIconClass} text-[#0F9D58]`} fill="#0F9D58" fillOpacity={0.2} />
          <span className={labelClass}>Google Sheets</span>
        </SubTrigger>
        <SubContent className={subContentClass}>
           <Item className={subItemClass}>Blank spreadsheet</Item>
           <Item className={subItemClass}>From a template</Item>
        </SubContent>
      </Sub>

      <Sub>
        <SubTrigger className={subTriggerClass}>
          <Presentation className={`${appIconClass} text-[#F4B400]`} fill="#F4B400" fillOpacity={0.2} />
          <span className={labelClass}>Google Slides</span>
        </SubTrigger>
        <SubContent className={subContentClass}>
           <Item className={subItemClass}>Blank presentation</Item>
           <Item className={subItemClass}>From a template</Item>
        </SubContent>
      </Sub>

      <Sub>
        <SubTrigger className={subTriggerClass}>
          <PlaySquare className={`${appIconClass} text-[#A142F4]`} fill="#A142F4" fillOpacity={0.2} />
          <span className={labelClass}>Google Vids</span>
        </SubTrigger>
        <SubContent className={subContentClass}>
           <Item className={subItemClass}>Blank video</Item>
        </SubContent>
      </Sub>

      <Sub>
        <SubTrigger className={subTriggerClass}>
          <ListTodo className={`${appIconClass} text-[#A142F4]`} fill="#A142F4" fillOpacity={0.2} />
          <span className={labelClass}>Google Forms</span>
        </SubTrigger>
        <SubContent className={subContentClass}>
           <Item className={subItemClass}>Blank form</Item>
           <Item className={subItemClass}>From a template</Item>
        </SubContent>
      </Sub>

      <Sub>
          <SubTrigger className={subTriggerClass}>
              <div className="w-[18px] h-[18px] flex items-center justify-center" />
              <span className={labelClass}>More</span>
          </SubTrigger>
          <SubContent className={subContentClass}>
              <Item className={subItemClass}>Google Drawings</Item>
              <Item className={subItemClass}>Google My Maps</Item>
              <Item className={subItemClass}>Google Sites</Item>
          </SubContent>
      </Sub>
    </>
  );
}

export function GlobalContextMenu({ children }: { children: React.ReactNode }) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div className="h-full w-full">{children}</div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-80 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 shadow-lg rounded-xl p-1.5 font-sans z-50 text-[#202124] dark:text-gray-100">
        <SharedDriveMenuItems 
          Item={ContextMenuItem}
          Separator={ContextMenuSeparator}
          Sub={ContextMenuSub}
          SubTrigger={ContextMenuSubTrigger}
          SubContent={ContextMenuSubContent}
        />
      </ContextMenuContent>
    </ContextMenu>
  );
}

export function NewDropdownMenu({ folderInputRef }: { folderInputRef: React.RefObject<HTMLInputElement | null> }) {
  return (
    <DropdownMenuContent
      align="start"
      className="w-80 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 shadow-lg rounded-xl p-1.5 font-sans z-50 text-[#202124] dark:text-gray-100"
    >
        <SharedDriveMenuItems 
          Item={DropdownMenuItem}
          Separator={DropdownMenuSeparator}
          Sub={DropdownMenuSub}
          SubTrigger={DropdownMenuSubTrigger}
          SubContent={DropdownMenuSubContent}
          folderInputRef={folderInputRef}
        />
    </DropdownMenuContent>
  );
}
