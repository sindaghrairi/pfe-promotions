package com.pfe.promotionplatform;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class PromotionPlatformApplication {

	public static void main(String[] args) {
		SpringApplication.run(PromotionPlatformApplication.class, args);
	}

}
