package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"smart-restaurant-api/internal/repositories"
)

type RestaurantHandler struct {
	restaurantRepo *repositories.RestaurantRepository
	menuRepo       *repositories.MenuRepository
}

func NewRestaurantHandler(
	restaurantRepo *repositories.RestaurantRepository,
	menuRepo *repositories.MenuRepository,
) *RestaurantHandler {
	return &RestaurantHandler{
		restaurantRepo: restaurantRepo,
		menuRepo:       menuRepo,
	}
}

func (h *RestaurantHandler) GetRestaurantBySlug(c *gin.Context) {
	slug := c.Param("restaurantSlug")
	rest, err := h.restaurantRepo.GetRestaurantBySlug(slug)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if rest == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "المطعم غير موجود"})
		return
	}
	c.JSON(http.StatusOK, rest)
}

func (h *RestaurantHandler) GetTableByToken(c *gin.Context) {
	slug := c.Param("restaurantSlug")
	token := c.Param("tableToken")

	rest, err := h.restaurantRepo.GetRestaurantBySlug(slug)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if rest == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "المطعم غير موجود"})
		return
	}

	table, err := h.restaurantRepo.GetTableByToken(rest.ID, token)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if table == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "رمز الطاولة غير صحيح أو غير متاح"})
		return
	}

	c.JSON(http.StatusOK, table)
}

func (h *RestaurantHandler) GetMenu(c *gin.Context) {
	slug := c.Param("restaurantSlug")
	rest, err := h.restaurantRepo.GetRestaurantBySlug(slug)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if rest == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "المطعم غير موجود"})
		return
	}

	categories, err := h.menuRepo.GetCategories(rest.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	products, err := h.menuRepo.GetProducts(rest.ID, "", "")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"restaurant": rest,
		"categories": categories,
		"products":   products,
	})
}

func (h *RestaurantHandler) GetCategories(c *gin.Context) {
	slug := c.Param("restaurantSlug")
	rest, err := h.restaurantRepo.GetRestaurantBySlug(slug)
	if err != nil || rest == nil {
		// Fallback check if param is ID
		rest, err = h.restaurantRepo.GetRestaurantByID(slug)
	}
	if rest == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "المطعم غير موجود"})
		return
	}

	categories, err := h.menuRepo.GetCategories(rest.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, categories)
}

func (h *RestaurantHandler) GetProducts(c *gin.Context) {
	slug := c.Param("restaurantSlug")
	rest, err := h.restaurantRepo.GetRestaurantBySlug(slug)
	if err != nil || rest == nil {
		// Fallback check if param is ID
		rest, err = h.restaurantRepo.GetRestaurantByID(slug)
	}
	if rest == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "المطعم غير موجود"})
		return
	}

	categoryID := c.Query("categoryId")
	query := c.Query("query")

	products, err := h.menuRepo.GetProducts(rest.ID, categoryID, query)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, products)
}

func (h *RestaurantHandler) GetProductByID(c *gin.Context) {
	productID := c.Param("productId")
	product, err := h.menuRepo.GetProductByID(productID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if product == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "المنتج غير موجود"})
		return
	}
	c.JSON(http.StatusOK, product)
}
