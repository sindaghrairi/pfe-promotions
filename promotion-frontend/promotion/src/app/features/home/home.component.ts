import { NgFor, NgIf, isPlatformBrowser } from '@angular/common';
import { Component, OnDestroy, OnInit, PLATFORM_ID, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';

import { PromotionDto } from '../../core/models/promo.model';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { PromotionService } from '../../core/services/promotion.service';
import { LanguageSwitcherComponent } from '../../shared/language-switcher/language-switcher.component';

interface CategoryItem {
  key: string;
  icon: string;
  category: string;
}

interface PartnerCard {
  name: string;
  slug: string;
  activePromotions: number;
  coupons: number;
  logo?: string;
}

interface PromotionCard {
  id: number;
  companySlug: string;
  companyName: string;
  title: string;
  category: string;
  discount: string;
  initialPrice: number;
  promotionalPrice: number;
  couponsRemaining: number;
  endDate: string;
  image: string;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [NgFor, NgIf, RouterLink, TranslatePipe, LanguageSwitcherComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css'
})
export class HomeComponent implements OnInit, OnDestroy {
  private readonly promotionService = inject(PromotionService);
  private readonly router = inject(Router);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);
  private carouselTimer?: ReturnType<typeof setInterval>;

  readonly categories: CategoryItem[] = [
    { key: 'HOME.CATEGORY_FASHION', icon: 'fashion', category: 'Mode' },
    { key: 'HOME.CATEGORY_BEAUTY', icon: 'beauty', category: 'Beaute' },
    { key: 'HOME.CATEGORY_SPORT', icon: 'sport', category: 'Sport' },
    { key: 'HOME.CATEGORY_HOME', icon: 'home', category: 'Maison' },
    { key: 'HOME.CATEGORY_FOOD', icon: 'food', category: 'Alimentaire' }
  ];

  readonly benefits = [
    { icon: 'shield', titleKey: 'HOME.BENEFIT_VERIFIED_TITLE', textKey: 'HOME.BENEFIT_VERIFIED_TEXT' },
    { icon: 'tag', titleKey: 'HOME.BENEFIT_PRICE_TITLE', textKey: 'HOME.BENEFIT_PRICE_TEXT' },
    { icon: 'clock', titleKey: 'HOME.BENEFIT_REALTIME_TITLE', textKey: 'HOME.BENEFIT_REALTIME_TEXT' },
    { icon: 'lock', titleKey: 'HOME.BENEFIT_PAYMENT_TITLE', textKey: 'HOME.BENEFIT_PAYMENT_TEXT' }
  ];

  partners: PartnerCard[] = [
    { name: 'Decathlon', slug: 'decathlon', activePromotions: 3, coupons: 120, logo: 'logo-decathlon.png' },
    { name: 'Monoprix', slug: 'monoprix', activePromotions: 2, coupons: 60, logo: 'logo-monoprix.png' },
    { name: 'Aziza', slug: 'aziza', activePromotions: 2, coupons: 95, logo: 'logo-aziza.png' },
    { name: 'Fatales', slug: 'fatales', activePromotions: 1, coupons: 80, logo: 'logo-fatales.png' },
    { name: 'Zara', slug: 'zara', activePromotions: 1, coupons: 45, logo: 'logo-zara.png' }
  ];

  topPromotions: PromotionCard[] = this.fallbackPromotions;
  dealPromotions: PromotionCard[] = this.fallbackPromotions;
  activeDealIndex = 0;
  carouselDirection: 'next' | 'prev' = 'next';
  isLoading = true;

  ngOnInit(): void {
    if (!this.isBrowser) {
      this.isLoading = false;
      return;
    }

    this.startDealCarousel();

    forkJoin({
      promotions: this.promotionService.listAllPublishedPromotions().pipe(
        timeout(5000),
        catchError(() => of([]))
      ),
      companySlugs: this.promotionService.listPublishedCompanySlugs().pipe(
        timeout(5000),
        catchError(() => of([]))
      )
    }).subscribe(({ promotions, companySlugs }) => {
      const validPromotions = promotions.filter((promotion) => this.isValidPromotion(promotion));
      const mappedPromotions = promotions.length
        ? promotions.map((promotion, index) => this.mapPromotion(promotion, index))
        : this.fallbackPromotions;

      this.topPromotions = mappedPromotions.slice(0, 5);
      this.dealPromotions = promotions.length
        ? validPromotions.map((promotion, index) => this.mapPromotion(promotion, index))
        : this.fallbackPromotions;
      this.activeDealIndex = 0;
      this.partners = this.buildPartners(mappedPromotions, companySlugs);
      this.isLoading = false;
      this.startDealCarousel();
    });
  }

  ngOnDestroy(): void {
    this.stopDealCarousel();
  }

  get dealOfDay(): PromotionCard | null {
    return this.dealPromotions[this.activeDealIndex] ?? null;
  }

  showNextDeal(): void {
    this.selectDeal(this.activeDealIndex + 1, 'next');
  }

  showPreviousDeal(): void {
    this.selectDeal(this.activeDealIndex - 1, 'prev');
  }

  selectDeal(index: number, direction: 'next' | 'prev' = 'next'): void {
    if (!this.dealPromotions.length) {
      return;
    }

    this.carouselDirection = direction;
    this.activeDealIndex = (index + this.dealPromotions.length) % this.dealPromotions.length;
  }

  pauseDealCarousel(): void {
    this.stopDealCarousel();
  }

  resumeDealCarousel(): void {
    this.startDealCarousel();
  }

  formatPrice(value: number): string {
    return `${new Intl.NumberFormat('fr-TN', { maximumFractionDigits: 0 }).format(value)} DT`;
  }

  formatDate(value: string): string {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return new Intl.DateTimeFormat('fr-TN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }).format(date);
  }

  searchPromotions(term: string): void {
    const search = term.trim();
    this.router.navigate(['/promotions'], {
      queryParams: search ? { search } : undefined
    });
  }

  private buildPartners(promotions: PromotionCard[], companySlugs: string[]): PartnerCard[] {
    const slugs = new Set([...this.partners.map((partner) => partner.slug), ...companySlugs]);

    return Array.from(slugs)
      .slice(0, 5)
      .map((slug) => {
        const companyPromotions = promotions.filter((promotion) => promotion.companySlug === slug);
        const fallback = this.partners.find((partner) => partner.slug === slug);

        return {
          name: fallback?.name ?? this.toCompanyName(slug),
          slug,
          activePromotions: companyPromotions.length || fallback?.activePromotions || 0,
          coupons:
            companyPromotions.reduce((total, promotion) => total + promotion.couponsRemaining, 0) ||
            fallback?.coupons ||
            0,
          logo: fallback?.logo
        };
      });
  }

  private startDealCarousel(): void {
    this.stopDealCarousel();

    if (!this.isBrowser || this.dealPromotions.length < 2) {
      return;
    }

    this.carouselTimer = setInterval(() => this.showNextDeal(), 4000);
  }

  private stopDealCarousel(): void {
    if (this.carouselTimer) {
      clearInterval(this.carouselTimer);
      this.carouselTimer = undefined;
    }
  }

  private isValidPromotion(promotion: PromotionDto): boolean {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const endDate = new Date(promotion.endDate);
    endDate.setHours(0, 0, 0, 0);

    return promotion.status === 'ACTIVE' && !Number.isNaN(endDate.getTime()) && endDate >= today;
  }

  private mapPromotion(promotion: PromotionDto, index: number): PromotionCard {
    const initialPrice = promotion.initialPrice ?? this.fallbackPromotions[index % this.fallbackPromotions.length].initialPrice;
    const promotionalPrice =
      promotion.promotionalPrice ??
      Math.max(1, Math.round(initialPrice * (1 - this.discountPercent(promotion.discount) / 100)));

    return {
      id: promotion.id,
      companySlug: promotion.companySlug,
      companyName: this.toCompanyName(promotion.companySlug),
      title: promotion.title,
      category: promotion.category,
      discount: promotion.discount || this.fallbackPromotions[index % this.fallbackPromotions.length].discount,
      initialPrice,
      promotionalPrice,
      couponsRemaining: Math.max(0, (promotion.usageCount || 80) - (promotion.claimedCount ?? 0)),
      endDate: promotion.endDate,
      image: this.imageForPromotion(promotion, index)
    };
  }

  private discountPercent(discount: string): number {
    const match = discount.match(/\d+/);
    return match ? Number(match[0]) : 15;
  }

  private imageForPromotion(promotion: PromotionDto, index: number): string {
    const title = promotion.title.toLowerCase();

    if (title.includes('giorgio armani') || title.includes('si eau de parfum')) {
      return 'partners/giorgio-armani-si-100ml.jpg';
    }

    if (title.includes('ysl') || title.includes('libre eau de parfum') || title.includes('yves saint laurent')) {
      return 'partners/ysl-libre.jpg';
    }

    if (title.includes('nina le rouge') || title.includes('nina rouge') || title.includes('nina ricci')) {
      return 'partners/nina-le-rouge-80ml.jpg';
    }

    if (promotion.companySlug === 'zara' && (title.includes('veste') || title.includes('cuir'))) {
      return 'partners/zara-veste-cuir.png';
    }

    if (promotion.companySlug === 'zara' && (title.includes('robe') || title.includes('halter') || title.includes('satinee') || title.includes('satinée'))) {
      return 'partners/zara-robe-halter-satinee.jpg';
    }

    return this.imageForCompany(promotion.companySlug, index);
  }

  private imageForCompany(companySlug: string, index: number): string {
    const images: Record<string, string> = {
      decathlon: 'partners/decathlon.png',
      monoprix: 'partners/monoprix-food.jpg',
      aziza: 'partners/azizapromos.jpg',
      fatales: 'partners/fatales.jpg',
      zara: 'partners/zara.jpg'
    };

    return images[companySlug] ?? this.fallbackPromotions[index % this.fallbackPromotions.length].image;
  }

  private toCompanyName(slug: string): string {
    return slug
      .split('-')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  private get fallbackPromotions(): PromotionCard[] {
    return [
      {
        id: 1,
        companySlug: 'decathlon',
        companyName: 'Decathlon',
        title: 'Chaussures Running Homme',
        category: 'Sport',
        discount: '-30%',
        initialPrice: 350,
        promotionalPrice: 245,
        couponsRemaining: 120,
        endDate: '2026-07-15',
        image: 'partners/decathlon.png'
      },
      {
        id: 2,
        companySlug: 'fatales',
        companyName: 'Fatales',
        title: 'Parfum La Vie Est Belle',
        category: 'Beaute',
        discount: '-20%',
        initialPrice: 230,
        promotionalPrice: 184,
        couponsRemaining: 80,
        endDate: '2026-07-10',
        image: 'partners/giorgio-armani-si-100ml.jpg'
      },
      {
        id: 3,
        companySlug: 'monoprix',
        companyName: 'Monoprix',
        title: 'Panier de produits frais',
        category: 'Alimentation',
        discount: '-15%',
        initialPrice: 80,
        promotionalPrice: 68,
        couponsRemaining: 60,
        endDate: '2026-06-30',
        image: 'partners/monoprix-food.jpg'
      },
      {
        id: 4,
        companySlug: 'zara',
        companyName: 'Zara',
        title: 'Collection Printemps',
        category: 'Mode',
        discount: '-25%',
        initialPrice: 200,
        promotionalPrice: 150,
        couponsRemaining: 45,
        endDate: '2026-07-05',
        image: 'partners/zara-veste-cuir.png'
      },
      {
        id: 5,
        companySlug: 'aziza',
        companyName: 'Aziza',
        title: 'Selection courses de la semaine',
        category: 'Alimentation',
        discount: '-10%',
        initialPrice: 90,
        promotionalPrice: 81,
        couponsRemaining: 95,
        endDate: '2026-06-25',
        image: 'partners/azizapromos.jpg'
      }
    ];
  }
}
