package com.pfe.promotionplatform.presentation.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class OAuth2CallbackRequest {
    @NotBlank(message = "Le code Google est obligatoire")
    private String code;

    private String state;
}
