package com.example.observability;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface LlmObserved {
    String service();
    String endpoint() default "";
    String provider() default "groq";
    String model() default "groq-auto";
}
