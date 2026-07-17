export interface ModuleChapter {
  chapterTitle: string;
  chapterContent: string;
  insightBox: string;
}

export interface ModuleScaffolding {
  remedialTitle: string;
  remedialContent: string;
  advancedTitle: string;
  advancedContent: string;
}

export interface LearningModule {
  title: string;
  mindMap: string;
  chapters: ModuleChapter[];
  scaffolding: ModuleScaffolding;
  footer: string;
  jenjang: string;
  kelas: string;
  materi: string;
}

export interface PresetTopic {
  jenjang: string;
  kelas: string;
  materi: string;
  description: string;
  icon: string;
}
