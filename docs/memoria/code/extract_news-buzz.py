import csv
import requests
import urllib.request
from bs4 import BeautifulSoup

def scraping_abc(url):
    """
    Comentario de la función
    """
    try:
        page = urllib.request.urlopen(url)
    except:
        print("An error occured.")
        return 'error', 'error' 

    soup = BeautifulSoup(page, 'html.parser')
    
    # Buscamos todos los parrafos (contenido)
    content_lis = soup.find_all('p')
    
    # Buscamos el titulo
    header = soup.find('header', attrs={'class': 'Article__Header'})
    title = header.find('h1').getText()

    # Imprimimos
    print('Title: ' + title)
    content = ''
    for p in content_lis:
        content = content + p.getText()
    print(content)

    return title, content

