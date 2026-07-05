import { z } from 'zod';
export declare const LocalizedTextSchema: z.ZodObject<{
    en: z.ZodString;
    ss: z.ZodString;
}, "strip", z.ZodTypeAny, {
    en: string;
    ss: string;
}, {
    en: string;
    ss: string;
}>;
export type LocalizedText = z.infer<typeof LocalizedTextSchema>;
export declare const LocaleSchema: z.ZodEnum<["en", "ss"]>;
export type Locale = z.infer<typeof LocaleSchema>;
export declare const ChoiceOptionSchema: z.ZodObject<{
    value: z.ZodString;
    label: z.ZodObject<{
        en: z.ZodString;
        ss: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        en: string;
        ss: string;
    }, {
        en: string;
        ss: string;
    }>;
}, "strip", z.ZodTypeAny, {
    value: string;
    label: {
        en: string;
        ss: string;
    };
}, {
    value: string;
    label: {
        en: string;
        ss: string;
    };
}>;
export type ChoiceOption = z.infer<typeof ChoiceOptionSchema>;
export declare const FieldSpecSchema: z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
    type: z.ZodLiteral<"text">;
    min: z.ZodOptional<z.ZodNumber>;
    max: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    type: "text";
    min?: number | undefined;
    max?: number | undefined;
}, {
    type: "text";
    min?: number | undefined;
    max?: number | undefined;
}>, z.ZodObject<{
    type: z.ZodLiteral<"number">;
    min: z.ZodOptional<z.ZodNumber>;
    max: z.ZodOptional<z.ZodNumber>;
    integer: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    type: "number";
    integer?: boolean | undefined;
    min?: number | undefined;
    max?: number | undefined;
}, {
    type: "number";
    integer?: boolean | undefined;
    min?: number | undefined;
    max?: number | undefined;
}>, z.ZodObject<{
    type: z.ZodLiteral<"money">;
}, "strip", z.ZodTypeAny, {
    type: "money";
}, {
    type: "money";
}>, z.ZodObject<{
    type: z.ZodLiteral<"choice">;
    options: z.ZodArray<z.ZodObject<{
        value: z.ZodString;
        label: z.ZodObject<{
            en: z.ZodString;
            ss: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            en: string;
            ss: string;
        }, {
            en: string;
            ss: string;
        }>;
    }, "strip", z.ZodTypeAny, {
        value: string;
        label: {
            en: string;
            ss: string;
        };
    }, {
        value: string;
        label: {
            en: string;
            ss: string;
        };
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    options: {
        value: string;
        label: {
            en: string;
            ss: string;
        };
    }[];
    type: "choice";
}, {
    options: {
        value: string;
        label: {
            en: string;
            ss: string;
        };
    }[];
    type: "choice";
}>, z.ZodObject<{
    type: z.ZodLiteral<"dynamic_choice">;
    source: z.ZodString;
}, "strip", z.ZodTypeAny, {
    type: "dynamic_choice";
    source: string;
}, {
    type: "dynamic_choice";
    source: string;
}>, z.ZodObject<{
    type: z.ZodLiteral<"msisdn">;
}, "strip", z.ZodTypeAny, {
    type: "msisdn";
}, {
    type: "msisdn";
}>, z.ZodObject<{
    type: z.ZodLiteral<"email">;
}, "strip", z.ZodTypeAny, {
    type: "email";
}, {
    type: "email";
}>, z.ZodObject<{
    type: z.ZodLiteral<"confirm">;
}, "strip", z.ZodTypeAny, {
    type: "confirm";
}, {
    type: "confirm";
}>]>;
export type FieldSpec = z.infer<typeof FieldSpecSchema>;
export declare const FlowStepSchema: z.ZodObject<{
    key: z.ZodString;
    prompt: z.ZodObject<{
        en: z.ZodString;
        ss: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        en: string;
        ss: string;
    }, {
        en: string;
        ss: string;
    }>;
    help: z.ZodOptional<z.ZodObject<{
        en: z.ZodString;
        ss: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        en: string;
        ss: string;
    }, {
        en: string;
        ss: string;
    }>>;
    summary_label: z.ZodOptional<z.ZodObject<{
        en: z.ZodString;
        ss: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        en: string;
        ss: string;
    }, {
        en: string;
        ss: string;
    }>>;
    optional: z.ZodOptional<z.ZodBoolean>;
    field: z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
        type: z.ZodLiteral<"text">;
        min: z.ZodOptional<z.ZodNumber>;
        max: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        type: "text";
        min?: number | undefined;
        max?: number | undefined;
    }, {
        type: "text";
        min?: number | undefined;
        max?: number | undefined;
    }>, z.ZodObject<{
        type: z.ZodLiteral<"number">;
        min: z.ZodOptional<z.ZodNumber>;
        max: z.ZodOptional<z.ZodNumber>;
        integer: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        type: "number";
        integer?: boolean | undefined;
        min?: number | undefined;
        max?: number | undefined;
    }, {
        type: "number";
        integer?: boolean | undefined;
        min?: number | undefined;
        max?: number | undefined;
    }>, z.ZodObject<{
        type: z.ZodLiteral<"money">;
    }, "strip", z.ZodTypeAny, {
        type: "money";
    }, {
        type: "money";
    }>, z.ZodObject<{
        type: z.ZodLiteral<"choice">;
        options: z.ZodArray<z.ZodObject<{
            value: z.ZodString;
            label: z.ZodObject<{
                en: z.ZodString;
                ss: z.ZodString;
            }, "strip", z.ZodTypeAny, {
                en: string;
                ss: string;
            }, {
                en: string;
                ss: string;
            }>;
        }, "strip", z.ZodTypeAny, {
            value: string;
            label: {
                en: string;
                ss: string;
            };
        }, {
            value: string;
            label: {
                en: string;
                ss: string;
            };
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        options: {
            value: string;
            label: {
                en: string;
                ss: string;
            };
        }[];
        type: "choice";
    }, {
        options: {
            value: string;
            label: {
                en: string;
                ss: string;
            };
        }[];
        type: "choice";
    }>, z.ZodObject<{
        type: z.ZodLiteral<"dynamic_choice">;
        source: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        type: "dynamic_choice";
        source: string;
    }, {
        type: "dynamic_choice";
        source: string;
    }>, z.ZodObject<{
        type: z.ZodLiteral<"msisdn">;
    }, "strip", z.ZodTypeAny, {
        type: "msisdn";
    }, {
        type: "msisdn";
    }>, z.ZodObject<{
        type: z.ZodLiteral<"email">;
    }, "strip", z.ZodTypeAny, {
        type: "email";
    }, {
        type: "email";
    }>, z.ZodObject<{
        type: z.ZodLiteral<"confirm">;
    }, "strip", z.ZodTypeAny, {
        type: "confirm";
    }, {
        type: "confirm";
    }>]>;
}, "strip", z.ZodTypeAny, {
    key: string;
    prompt: {
        en: string;
        ss: string;
    };
    field: {
        type: "text";
        min?: number | undefined;
        max?: number | undefined;
    } | {
        type: "number";
        integer?: boolean | undefined;
        min?: number | undefined;
        max?: number | undefined;
    } | {
        type: "money";
    } | {
        options: {
            value: string;
            label: {
                en: string;
                ss: string;
            };
        }[];
        type: "choice";
    } | {
        type: "dynamic_choice";
        source: string;
    } | {
        type: "msisdn";
    } | {
        type: "email";
    } | {
        type: "confirm";
    };
    help?: {
        en: string;
        ss: string;
    } | undefined;
    summary_label?: {
        en: string;
        ss: string;
    } | undefined;
    optional?: boolean | undefined;
}, {
    key: string;
    prompt: {
        en: string;
        ss: string;
    };
    field: {
        type: "text";
        min?: number | undefined;
        max?: number | undefined;
    } | {
        type: "number";
        integer?: boolean | undefined;
        min?: number | undefined;
        max?: number | undefined;
    } | {
        type: "money";
    } | {
        options: {
            value: string;
            label: {
                en: string;
                ss: string;
            };
        }[];
        type: "choice";
    } | {
        type: "dynamic_choice";
        source: string;
    } | {
        type: "msisdn";
    } | {
        type: "email";
    } | {
        type: "confirm";
    };
    help?: {
        en: string;
        ss: string;
    } | undefined;
    summary_label?: {
        en: string;
        ss: string;
    } | undefined;
    optional?: boolean | undefined;
}>;
export type FlowStep = z.infer<typeof FlowStepSchema>;
export declare const FlowCompletionSchema: z.ZodObject<{
    mode: z.ZodEnum<["submit_in_chat", "draft_then_portal"]>;
    portal_deeplink_path: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    mode: "submit_in_chat" | "draft_then_portal";
    portal_deeplink_path?: string | undefined;
}, {
    mode: "submit_in_chat" | "draft_then_portal";
    portal_deeplink_path?: string | undefined;
}>;
export type FlowCompletion = z.infer<typeof FlowCompletionSchema>;
export declare const FlowDefinitionSchema: z.ZodEffects<z.ZodObject<{
    key: z.ZodString;
    version: z.ZodNumber;
    title: z.ZodObject<{
        en: z.ZodString;
        ss: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        en: string;
        ss: string;
    }, {
        en: string;
        ss: string;
    }>;
    steps: z.ZodArray<z.ZodObject<{
        key: z.ZodString;
        prompt: z.ZodObject<{
            en: z.ZodString;
            ss: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            en: string;
            ss: string;
        }, {
            en: string;
            ss: string;
        }>;
        help: z.ZodOptional<z.ZodObject<{
            en: z.ZodString;
            ss: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            en: string;
            ss: string;
        }, {
            en: string;
            ss: string;
        }>>;
        summary_label: z.ZodOptional<z.ZodObject<{
            en: z.ZodString;
            ss: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            en: string;
            ss: string;
        }, {
            en: string;
            ss: string;
        }>>;
        optional: z.ZodOptional<z.ZodBoolean>;
        field: z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
            type: z.ZodLiteral<"text">;
            min: z.ZodOptional<z.ZodNumber>;
            max: z.ZodOptional<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            type: "text";
            min?: number | undefined;
            max?: number | undefined;
        }, {
            type: "text";
            min?: number | undefined;
            max?: number | undefined;
        }>, z.ZodObject<{
            type: z.ZodLiteral<"number">;
            min: z.ZodOptional<z.ZodNumber>;
            max: z.ZodOptional<z.ZodNumber>;
            integer: z.ZodOptional<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            type: "number";
            integer?: boolean | undefined;
            min?: number | undefined;
            max?: number | undefined;
        }, {
            type: "number";
            integer?: boolean | undefined;
            min?: number | undefined;
            max?: number | undefined;
        }>, z.ZodObject<{
            type: z.ZodLiteral<"money">;
        }, "strip", z.ZodTypeAny, {
            type: "money";
        }, {
            type: "money";
        }>, z.ZodObject<{
            type: z.ZodLiteral<"choice">;
            options: z.ZodArray<z.ZodObject<{
                value: z.ZodString;
                label: z.ZodObject<{
                    en: z.ZodString;
                    ss: z.ZodString;
                }, "strip", z.ZodTypeAny, {
                    en: string;
                    ss: string;
                }, {
                    en: string;
                    ss: string;
                }>;
            }, "strip", z.ZodTypeAny, {
                value: string;
                label: {
                    en: string;
                    ss: string;
                };
            }, {
                value: string;
                label: {
                    en: string;
                    ss: string;
                };
            }>, "many">;
        }, "strip", z.ZodTypeAny, {
            options: {
                value: string;
                label: {
                    en: string;
                    ss: string;
                };
            }[];
            type: "choice";
        }, {
            options: {
                value: string;
                label: {
                    en: string;
                    ss: string;
                };
            }[];
            type: "choice";
        }>, z.ZodObject<{
            type: z.ZodLiteral<"dynamic_choice">;
            source: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            type: "dynamic_choice";
            source: string;
        }, {
            type: "dynamic_choice";
            source: string;
        }>, z.ZodObject<{
            type: z.ZodLiteral<"msisdn">;
        }, "strip", z.ZodTypeAny, {
            type: "msisdn";
        }, {
            type: "msisdn";
        }>, z.ZodObject<{
            type: z.ZodLiteral<"email">;
        }, "strip", z.ZodTypeAny, {
            type: "email";
        }, {
            type: "email";
        }>, z.ZodObject<{
            type: z.ZodLiteral<"confirm">;
        }, "strip", z.ZodTypeAny, {
            type: "confirm";
        }, {
            type: "confirm";
        }>]>;
    }, "strip", z.ZodTypeAny, {
        key: string;
        prompt: {
            en: string;
            ss: string;
        };
        field: {
            type: "text";
            min?: number | undefined;
            max?: number | undefined;
        } | {
            type: "number";
            integer?: boolean | undefined;
            min?: number | undefined;
            max?: number | undefined;
        } | {
            type: "money";
        } | {
            options: {
                value: string;
                label: {
                    en: string;
                    ss: string;
                };
            }[];
            type: "choice";
        } | {
            type: "dynamic_choice";
            source: string;
        } | {
            type: "msisdn";
        } | {
            type: "email";
        } | {
            type: "confirm";
        };
        help?: {
            en: string;
            ss: string;
        } | undefined;
        summary_label?: {
            en: string;
            ss: string;
        } | undefined;
        optional?: boolean | undefined;
    }, {
        key: string;
        prompt: {
            en: string;
            ss: string;
        };
        field: {
            type: "text";
            min?: number | undefined;
            max?: number | undefined;
        } | {
            type: "number";
            integer?: boolean | undefined;
            min?: number | undefined;
            max?: number | undefined;
        } | {
            type: "money";
        } | {
            options: {
                value: string;
                label: {
                    en: string;
                    ss: string;
                };
            }[];
            type: "choice";
        } | {
            type: "dynamic_choice";
            source: string;
        } | {
            type: "msisdn";
        } | {
            type: "email";
        } | {
            type: "confirm";
        };
        help?: {
            en: string;
            ss: string;
        } | undefined;
        summary_label?: {
            en: string;
            ss: string;
        } | undefined;
        optional?: boolean | undefined;
    }>, "many">;
    completion: z.ZodObject<{
        mode: z.ZodEnum<["submit_in_chat", "draft_then_portal"]>;
        portal_deeplink_path: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        mode: "submit_in_chat" | "draft_then_portal";
        portal_deeplink_path?: string | undefined;
    }, {
        mode: "submit_in_chat" | "draft_then_portal";
        portal_deeplink_path?: string | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    key: string;
    version: number;
    title: {
        en: string;
        ss: string;
    };
    steps: {
        key: string;
        prompt: {
            en: string;
            ss: string;
        };
        field: {
            type: "text";
            min?: number | undefined;
            max?: number | undefined;
        } | {
            type: "number";
            integer?: boolean | undefined;
            min?: number | undefined;
            max?: number | undefined;
        } | {
            type: "money";
        } | {
            options: {
                value: string;
                label: {
                    en: string;
                    ss: string;
                };
            }[];
            type: "choice";
        } | {
            type: "dynamic_choice";
            source: string;
        } | {
            type: "msisdn";
        } | {
            type: "email";
        } | {
            type: "confirm";
        };
        help?: {
            en: string;
            ss: string;
        } | undefined;
        summary_label?: {
            en: string;
            ss: string;
        } | undefined;
        optional?: boolean | undefined;
    }[];
    completion: {
        mode: "submit_in_chat" | "draft_then_portal";
        portal_deeplink_path?: string | undefined;
    };
}, {
    key: string;
    version: number;
    title: {
        en: string;
        ss: string;
    };
    steps: {
        key: string;
        prompt: {
            en: string;
            ss: string;
        };
        field: {
            type: "text";
            min?: number | undefined;
            max?: number | undefined;
        } | {
            type: "number";
            integer?: boolean | undefined;
            min?: number | undefined;
            max?: number | undefined;
        } | {
            type: "money";
        } | {
            options: {
                value: string;
                label: {
                    en: string;
                    ss: string;
                };
            }[];
            type: "choice";
        } | {
            type: "dynamic_choice";
            source: string;
        } | {
            type: "msisdn";
        } | {
            type: "email";
        } | {
            type: "confirm";
        };
        help?: {
            en: string;
            ss: string;
        } | undefined;
        summary_label?: {
            en: string;
            ss: string;
        } | undefined;
        optional?: boolean | undefined;
    }[];
    completion: {
        mode: "submit_in_chat" | "draft_then_portal";
        portal_deeplink_path?: string | undefined;
    };
}>, {
    key: string;
    version: number;
    title: {
        en: string;
        ss: string;
    };
    steps: {
        key: string;
        prompt: {
            en: string;
            ss: string;
        };
        field: {
            type: "text";
            min?: number | undefined;
            max?: number | undefined;
        } | {
            type: "number";
            integer?: boolean | undefined;
            min?: number | undefined;
            max?: number | undefined;
        } | {
            type: "money";
        } | {
            options: {
                value: string;
                label: {
                    en: string;
                    ss: string;
                };
            }[];
            type: "choice";
        } | {
            type: "dynamic_choice";
            source: string;
        } | {
            type: "msisdn";
        } | {
            type: "email";
        } | {
            type: "confirm";
        };
        help?: {
            en: string;
            ss: string;
        } | undefined;
        summary_label?: {
            en: string;
            ss: string;
        } | undefined;
        optional?: boolean | undefined;
    }[];
    completion: {
        mode: "submit_in_chat" | "draft_then_portal";
        portal_deeplink_path?: string | undefined;
    };
}, {
    key: string;
    version: number;
    title: {
        en: string;
        ss: string;
    };
    steps: {
        key: string;
        prompt: {
            en: string;
            ss: string;
        };
        field: {
            type: "text";
            min?: number | undefined;
            max?: number | undefined;
        } | {
            type: "number";
            integer?: boolean | undefined;
            min?: number | undefined;
            max?: number | undefined;
        } | {
            type: "money";
        } | {
            options: {
                value: string;
                label: {
                    en: string;
                    ss: string;
                };
            }[];
            type: "choice";
        } | {
            type: "dynamic_choice";
            source: string;
        } | {
            type: "msisdn";
        } | {
            type: "email";
        } | {
            type: "confirm";
        };
        help?: {
            en: string;
            ss: string;
        } | undefined;
        summary_label?: {
            en: string;
            ss: string;
        } | undefined;
        optional?: boolean | undefined;
    }[];
    completion: {
        mode: "submit_in_chat" | "draft_then_portal";
        portal_deeplink_path?: string | undefined;
    };
}>;
export type FlowDefinition = z.infer<typeof FlowDefinitionSchema>;
export type AnswerValue = string | number;
export declare const FlowSessionStateSchema: z.ZodObject<{
    flow_key: z.ZodString;
    flow_version: z.ZodNumber;
    step_index: z.ZodNumber;
    answers: z.ZodRecord<z.ZodString, z.ZodUnion<[z.ZodString, z.ZodNumber]>>;
    answer_labels: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    locale: z.ZodEnum<["en", "ss"]>;
}, "strip", z.ZodTypeAny, {
    flow_key: string;
    flow_version: number;
    step_index: number;
    answers: Record<string, string | number>;
    locale: "en" | "ss";
    answer_labels?: Record<string, string> | undefined;
}, {
    flow_key: string;
    flow_version: number;
    step_index: number;
    answers: Record<string, string | number>;
    locale: "en" | "ss";
    answer_labels?: Record<string, string> | undefined;
}>;
export type FlowSessionState = z.infer<typeof FlowSessionStateSchema>;
export type FlowStatus = 'in_progress' | 'complete' | 'cancelled';
export interface FlowTurnResult {
    sessionState: FlowSessionState;
    replies: string[];
    status: FlowStatus;
    answers?: Record<string, AnswerValue>;
}
export interface FlowContext {
    /** Resolved options for dynamic_choice steps, keyed by step.key. */
    options?: Record<string, ChoiceOption[]>;
}
